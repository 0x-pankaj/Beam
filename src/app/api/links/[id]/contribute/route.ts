import { NextRequest, NextResponse } from "next/server";
import { addContribution, getLink } from "@/lib/links";

// A payer contributes their share toward a split link (settled on Arbitrum).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.direction !== "split")
    return NextResponse.json({ error: "not a split link" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { address, email, amountUsd, txId } = body ?? {};
  if (!address || !txId || !amountUsd || Number(amountUsd) <= 0)
    return NextResponse.json({ error: "invalid contribution" }, { status: 400 });

  const next = await addContribution(id, {
    address: String(address),
    email: email ? String(email).slice(0, 80) : undefined,
    amountUsd: String(amountUsd),
    txId: String(txId),
    at: Date.now(),
  });
  return NextResponse.json(next);
}
