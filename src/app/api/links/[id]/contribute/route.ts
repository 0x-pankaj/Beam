import { NextRequest, NextResponse } from "next/server";
import { addContribution, getLink, isCampaign, publicLink } from "@/lib/links";

// A payer contributes toward a campaign (split / fund / product), settled on
// Arbitrum. For products, the unlock content is returned to the buyer who paid.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isCampaign(link.direction))
    return NextResponse.json({ error: "not a campaign link" }, { status: 400 });

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

  return NextResponse.json({
    link: next ? publicLink(next) : null,
    // Reveal the product's content to the buyer who just paid.
    unlocked: link.direction === "product" ? link.unlockUrl ?? null : null,
  });
}
