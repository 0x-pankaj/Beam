import { NextRequest, NextResponse } from "next/server";
import { getLink, updateLink, reserveEscrow } from "@/lib/links";
import { relayerConfigured, payoutUsdc } from "@/lib/relayer";
import { isEvmAddress } from "@/lib/validate";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// The sender reclaims an unclaimed, funded "send" link. The escrow returns the
// USDC to the sender on Arbitrum so funds are never stranded if nobody claims.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(req, "refund", 15)) return tooMany();
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

  // Single-shot guard: flip out of "funded" before paying so a double request
  // can't refund twice.
  await updateLink(id, { status: "sending" });

  const payout = await payoutUsdc(link.senderAddress, link.amountUsd);
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
  await reserveEscrow(-Number(link.amountUsd));
  return NextResponse.json(next);
}
