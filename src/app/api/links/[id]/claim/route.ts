import { NextRequest, NextResponse, after } from "next/server";
import {
  acquireLinkLock,
  getLink,
  releaseLinkLock,
  reserveEscrow,
  updateLink,
} from "@/lib/links";
import { isEvmAddress, isEmail } from "@/lib/validate";
import { relayerConfigured, payoutUsdc } from "@/lib/relayer";
import { requireProductionReady } from "@/lib/guard";
import { notifyRecipientPaid } from "@/lib/email";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// Escrow payout waits for an on-chain confirmation.
export const maxDuration = 60;

// The recipient opens a "send" link and logs in. We record their address and —
// when the link is funded in escrow — pay them out immediately from the relayer.
// Payout no longer depends on the sender being online: the money is already held.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await rateLimit(req, "claim", 15))) return tooMany();
  const notReady = requireProductionReady();
  if (notReady) return notReady;
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.status === "paid") return NextResponse.json(link); // idempotent

  const body = await req.json().catch(() => null);
  const claimantAddress = body?.claimantAddress;
  if (!isEvmAddress(claimantAddress))
    return NextResponse.json({ error: "invalid claimant address" }, { status: 400 });
  const claimantEmail =
    body?.claimantEmail && isEmail(body.claimantEmail)
      ? String(body.claimantEmail).slice(0, 80)
      : undefined;

  const escrow =
    link.direction === "send" &&
    link.status === "funded" &&
    relayerConfigured();

  // Legacy / unfunded path: just record the claimant for the sender to pay.
  if (!escrow) {
    const next = await updateLink(id, {
      status: link.status === "pending" ? "claiming" : link.status,
      claimantAddress,
      claimantEmail,
    });
    return NextResponse.json(next);
  }

  // Escrow payout — serialize on a per-link lock so concurrent claims (or a
  // claim racing a refund) can never both reach payoutUsdc, then re-read the
  // link under the lock and settle only from a verified "funded" state.
  if (!(await acquireLinkLock(id)))
    return NextResponse.json(
      { error: "settlement already in flight — try again in a moment" },
      { status: 409 },
    );
  try {
    const fresh = await getLink(id);
    if (!fresh || fresh.status !== "funded")
      return NextResponse.json(fresh ?? link);

    await updateLink(id, { status: "sending", claimantAddress, claimantEmail });

    const payout = await payoutUsdc(claimantAddress, fresh.amountUsd);
    if (!payout.ok) {
      // Roll back so the recipient (or a retry) can try again — funds stay locked.
      const reverted = await updateLink(id, { status: "funded" });
      return NextResponse.json(
        { error: payout.error || "payout failed", link: reverted },
        { status: 502 },
      );
    }

    const next = await updateLink(id, {
      status: "paid",
      payoutTxId: payout.txHash,
      txId: payout.txHash,
      paidAt: Date.now(),
    });
    // Funds have left the escrow — free their reservation.
    await reserveEscrow(-Number(fresh.amountUsd));

    if (claimantEmail) {
      after(() =>
        notifyRecipientPaid({
          to: claimantEmail,
          amountUsd: fresh.amountUsd,
          fromLabel: fresh.senderName,
        }),
      );
    }

    return NextResponse.json(next);
  } finally {
    await releaseLinkLock(id);
  }
}
