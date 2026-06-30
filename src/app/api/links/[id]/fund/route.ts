import { NextRequest, NextResponse } from "next/server";
import { getLink, updateLink, reserveEscrow, getReservedEscrow } from "@/lib/links";
import { relayerAddress, relayerConfigured } from "@/lib/relayer";
import { waitForUsdcBalance } from "@/lib/arbitrum";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// The sender deposited USDC into the escrow relayer for a "send" link. We verify
// the deposit ON-CHAIN by reconciling the relayer's real USDC balance against the
// amount already reserved for other funded links, then lock the link as "funded".
// From here the recipient's payout is guaranteed regardless of the sender.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(req, "fund", 15)) return tooMany();
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
  // The Particle activity id (opaque) — stored for the activity link, not verified.
  const fundTxId = body?.txId ? String(body.txId).slice(0, 120) : undefined;

  const amount = Number(link.amountUsd);

  // Reserve first (atomic), then confirm the on-chain balance covers the full
  // reserved total. This is race-safe: concurrent deposits each reserve their
  // own slice and must each be backed by real balance, or they roll back.
  const reservedAfter = await reserveEscrow(amount);
  const balance = await waitForUsdcBalance(escrow, reservedAfter);

  if (balance + 0.01 < reservedAfter) {
    await reserveEscrow(-amount); // release our reservation; deposit not seen yet
    const reserved = await getReservedEscrow();
    return NextResponse.json(
      {
        error: "deposit not yet confirmed on Arbitrum — try again in a moment",
        escrowBalance: balance,
        reserved,
      },
      { status: 402 },
    );
  }

  const next = await updateLink(id, { status: "funded", fundTxId });
  return NextResponse.json(next);
}
