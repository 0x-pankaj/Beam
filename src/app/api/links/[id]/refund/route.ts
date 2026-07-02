import { NextRequest, NextResponse } from "next/server";
import {
  acquireLinkLock,
  getLink,
  releaseLinkLock,
  reserveEscrow,
  updateLink,
} from "@/lib/links";
import { relayerConfigured, payoutUsdc } from "@/lib/relayer";
import { verifyLinkAction } from "@/lib/auth";
import { isEvmAddress } from "@/lib/validate";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// Escrow refund waits for an on-chain confirmation.
export const maxDuration = 60;

// The sender reclaims an unclaimed, funded "send" link. The escrow returns the
// USDC to the sender on Arbitrum so funds are never stranded if nobody claims.
// Only the sender may trigger this: they prove ownership of senderAddress by
// signing the refund request with their Magic EOA (anyone else knowing the
// link id could otherwise cancel a payment out from under its recipient).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await rateLimit(req, "refund", 15))) return tooMany();
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.direction !== "send")
    return NextResponse.json({ error: "not a send link" }, { status: 400 });
  if (link.status !== "funded")
    return NextResponse.json(
      { error: `cannot refund a ${link.status} link` },
      { status: 409 },
    );
  if (!relayerConfigured())
    return NextResponse.json({ error: "escrow not configured" }, { status: 503 });
  if (!isEvmAddress(link.senderAddress))
    return NextResponse.json({ error: "bad sender address" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!verifyLinkAction("refund", id, link.senderAddress, body))
    return NextResponse.json(
      { error: "refund must be signed by the sender" },
      { status: 403 },
    );

  // Serialize on the per-link lock (shared with claim) and re-read under it so
  // a refund can never race a claim payout into a double spend.
  if (!(await acquireLinkLock(id)))
    return NextResponse.json(
      { error: "settlement already in flight — try again in a moment" },
      { status: 409 },
    );
  try {
    const fresh = await getLink(id);
    if (!fresh || fresh.status !== "funded")
      return NextResponse.json(
        { error: `cannot refund a ${fresh?.status ?? "missing"} link` },
        { status: 409 },
      );

    await updateLink(id, { status: "sending" });

    const payout = await payoutUsdc(fresh.senderAddress, fresh.amountUsd);
    if (!payout.ok) {
      const reverted = await updateLink(id, { status: "funded" });
      return NextResponse.json(
        { error: payout.error || "refund failed", link: reverted },
        { status: 502 },
      );
    }

    const next = await updateLink(id, {
      status: "refunded",
      payoutTxId: payout.txHash,
      txId: payout.txHash,
    });
    // Funds have left the escrow — free their reservation.
    await reserveEscrow(-Number(fresh.amountUsd));
    return NextResponse.json(next);
  } finally {
    await releaseLinkLock(id);
  }
}
