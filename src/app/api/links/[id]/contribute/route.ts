import { NextRequest, NextResponse, after } from "next/server";
import {
  addContribution,
  getLink,
  isCampaign,
  markTxUsed,
  publicLink,
  REASON_META,
} from "@/lib/links";
import { notifyCreatorPaid } from "@/lib/email";
import { short } from "@/lib/format";
import { isEvmAddress, isEmail } from "@/lib/validate";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// A payer contributes toward a campaign (split / fund / product), settled on
// Arbitrum. For products, the unlock content is returned to the buyer who paid.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(req, "contribute", 20)) return tooMany();
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isCampaign(link.direction))
    return NextResponse.json({ error: "not a campaign link" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { address, email, amountUsd, txId } = body ?? {};
  if (!isEvmAddress(address) || !txId || typeof txId !== "string" || !amountUsd || Number(amountUsd) <= 0)
    return NextResponse.json({ error: "invalid contribution" }, { status: 400 });
  // Replay guard: the same settlement can't be counted toward two contributions.
  if (!(await markTxUsed(txId)))
    return NextResponse.json({ error: "tx already used" }, { status: 409 });

  const contributorEmail = isEmail(email) ? String(email).slice(0, 80) : undefined;
  const next = await addContribution(id, {
    address: String(address),
    email: contributorEmail,
    amountUsd: String(amountUsd),
    txId: String(txId),
    at: Date.now(),
  });

  // Notify the creator that they got paid (no-ops without Resend).
  after(() =>
    notifyCreatorPaid({
      to: link.senderEmail ?? link.senderName,
      amountUsd: String(amountUsd),
      what: link.title || REASON_META[link.reason].label,
      fromLabel: contributorEmail ?? short(String(address)),
    }),
  );

  return NextResponse.json({
    link: next ? publicLink(next) : null,
    // Reveal the product's content to the buyer who just paid.
    unlocked: link.direction === "product" ? link.unlockUrl ?? null : null,
  });
}
