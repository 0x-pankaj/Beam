import { NextRequest, NextResponse } from "next/server";
import { getLink, updateLink } from "@/lib/links";

// The sender reports the settled UA transaction, marking the link paid.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const txId = body?.txId;
  if (!txId) return NextResponse.json({ error: "missing txId" }, { status: 400 });

  const next = updateLink(id, {
    status: "paid",
    txId: String(txId),
    paidAt: Date.now(),
  });
  return NextResponse.json(next);
}
