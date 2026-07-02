import { NextResponse } from "next/server";
import { getLink, updateLink } from "@/lib/links";

// The payer has approved and the cross-chain settlement is in flight. Purely
// cosmetic (drives the recipient's spinner) — so only the harmless
// pending/claiming → sending transition is allowed. Money-bearing states
// (funded/paid/refunded) are owned by the escrow routes and must never be
// flipped from here: a stranger moving a funded link to "sending" would wedge
// its claim.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.status !== "pending" && link.status !== "claiming")
    return NextResponse.json(link);
  const next = await updateLink(id, { status: "sending" });
  return NextResponse.json(next);
}
