import { NextRequest, NextResponse, after } from "next/server";
import { getLink, updateLink, reserveEscrow } from "@/lib/links";
import { isEvmAddress, isEmail } from "@/lib/validate";
import { relayerConfigured, payoutUsdc } from "@/lib/relayer";
import { notifyRecipientPaid } from "@/lib/email";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// The recipient opens a "send" link and logs in. We record their address and —
// when the link is funded in escrow — pay them out immediately from the relayer.
// Payout no longer depends on the sender being online: the money is already held.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(req, "claim", 15)) return tooMany();
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

  // Escrow payout — guard on status so we settle exactly once but can retry on
  // failure. Flip funded → sending; if it's no longer "funded", a payout is
  // already in flight, so just return the current state.
  const claiming = await updateLink(id, {
    status: "sending",
    claimantAddress,
    claimantEmail,
  });
  if (link.status !== "funded")
    return NextResponse.json(claiming);

  const payout = await payoutUsdc(claimantAddress, link.amountUsd);
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
  await reserveEscrow(-Number(link.amountUsd));

  if (claimantEmail) {
    after(() =>
      notifyRecipientPaid({
        to: claimantEmail,
        amountUsd: link.amountUsd,
        fromLabel: link.senderName,
      }),
    );
  }

  return NextResponse.json(next);
}
