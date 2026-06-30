import { NextRequest, NextResponse, after } from "next/server";
import {
  addContribution,
  collectedUsd,
  getLink,
  isCampaign,
  markTxUsed,
  publicLink,
  updateLink,
  REASON_META,
  type BeamLink,
} from "@/lib/links";
import { notifyCreatorPaid } from "@/lib/email";
import { short } from "@/lib/format";
import { isEvmAddress, isEmail } from "@/lib/validate";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import {
  relayerConfigured,
  campaignBalanceUsd,
  campaignDepositAddress,
  sweepCampaignTo,
} from "@/lib/relayer";

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
  let current = await addContribution(id, {
    address: String(address),
    email: contributorEmail,
    amountUsd: String(amountUsd),
    txId: String(txId),
    at: Date.now(),
  });

  // Verify the total ON-CHAIN: read the campaign escrow's real USDC balance so
  // "amount raised" is provable, not just the sum of self-reported amounts.
  const escrow = relayerConfigured();
  if (current && escrow) {
    const verified = await campaignBalanceUsd(id);
    const raised = verified + (current.withdrawnUsd ?? 0);
    const target = Number(link.amountUsd);
    const filled = link.direction === "split" && raised + 0.01 >= target;
    current =
      (await updateLink(id, {
        verifiedUsd: verified,
        ...(filled ? { status: "paid", paidAt: Date.now() } : {}),
      })) ?? current;

    // A split that just filled: sweep the escrow to the creator and record it.
    if (filled) {
      const swept = await sweepCampaignTo(id, link.senderAddress);
      if (swept.ok)
        current =
          (await updateLink(id, {
            withdrawnUsd: (current.withdrawnUsd ?? 0) + (swept.amountUsd ?? verified),
            verifiedUsd: 0,
          })) ?? current;
    }
  } else if (current && !escrow) {
    // No relayer: fall back to closing a split on self-reported sums.
    const filled =
      link.direction === "split" &&
      collectedUsd(current) + 0.01 >= Number(link.amountUsd);
    if (filled)
      current = (await updateLink(id, { status: "paid", paidAt: Date.now() })) ?? current;
  }

  // Notify the creator that they got paid (no-ops without Resend).
  after(() =>
    notifyCreatorPaid({
      to: link.senderEmail ?? link.senderName,
      amountUsd: String(amountUsd),
      what: link.title || REASON_META[link.reason].label,
      fromLabel: contributorEmail ?? short(String(address)),
    }),
  );

  const withAddress: BeamLink | null = current
    ? { ...publicLink(current), escrowAddress: campaignDepositAddress(id) ?? undefined }
    : null;
  return NextResponse.json({
    link: withAddress,
    // Reveal the product's content to the buyer who just paid.
    unlocked: link.direction === "product" ? link.unlockUrl ?? null : null,
  });
}
