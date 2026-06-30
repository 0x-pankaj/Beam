import { NextRequest, NextResponse } from "next/server";
import { getLink, updateLink, markTxUsed } from "@/lib/links";
import { relayerAddress, relayerConfigured } from "@/lib/relayer";
import { verifyUsdcTransfer } from "@/lib/arbitrum";
import { isTxHash } from "@/lib/validate";

// The sender deposited USDC into the escrow relayer for a "send" link. We verify
// the deposit landed on-chain, then lock the link as "funded" — from here the
// recipient's payout is guaranteed and no longer depends on the sender.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.direction !== "send")
    return NextResponse.json({ error: "not a send link" }, { status: 400 });
  if (link.status === "funded" || link.status === "paid")
    return NextResponse.json(link); // idempotent

  const escrow = relayerAddress();
  if (!relayerConfigured() || !escrow)
    return NextResponse.json({ error: "escrow not configured" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const txId = body?.txId;
  if (!isTxHash(txId))
    return NextResponse.json({ error: "missing/invalid txId" }, { status: 400 });

  // Reject replays before we trust the deposit.
  if (!(await markTxUsed(txId)))
    return NextResponse.json({ error: "tx already used" }, { status: 409 });

  const check = await verifyUsdcTransfer(txId, escrow, Number(link.amountUsd));
  if (!check.ok)
    return NextResponse.json(
      { error: `deposit not verified: ${check.error ?? "no matching transfer"}` },
      { status: 402 },
    );

  const next = await updateLink(id, { status: "funded", fundTxId: String(txId) });
  return NextResponse.json(next);
}
