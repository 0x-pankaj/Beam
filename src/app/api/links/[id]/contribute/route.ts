import { NextRequest, NextResponse, after } from "next/server";
import {
  acquireLinkLock,
  addContribution,
  collectedUsd,
  getLink,
  isCampaign,
  markTxUsed,
  publicLink,
  releaseLinkLock,
  unmarkTxUsed,
  updateLink,
  REASON_META,
  type BeamLink,
} from "@/lib/links";
import { notifyCreatorPaid } from "@/lib/email";
import { short } from "@/lib/format";
import { isEvmAddress, isEmail } from "@/lib/validate";
import { requireProductionReady } from "@/lib/guard";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { waitForUsdcBalance } from "@/lib/arbitrum";
import {
  relayerConfigured,
  campaignBalanceUsd,
  campaignDepositAddress,
  sweepCampaignTo,
} from "@/lib/relayer";

// On-chain verification + a possible sweep wait for confirmations.
export const maxDuration = 60;

// A payer contributes toward a campaign (split / fund / product), settled on
// Arbitrum into the campaign's own escrow deposit address. With the relayer
// configured (production), the contribution is only credited — and a product
// only unlocked — once the escrow's real on-chain USDC balance covers it. The
// self-reported fallback exists for local dev only; production refuses to run
// without the relayer.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await rateLimit(req, "contribute", 20))) return tooMany();
  const notReady = requireProductionReady();
  if (notReady) return notReady;
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isCampaign(link.direction))
    return NextResponse.json({ error: "not a campaign link" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { address, email, amountUsd, txId } = body ?? {};
  if (!isEvmAddress(address) || !txId || typeof txId !== "string" || !amountUsd || Number(amountUsd) <= 0)
    return NextResponse.json({ error: "invalid contribution" }, { status: 400 });
  const contributorEmail = isEmail(email) ? String(email).slice(0, 80) : undefined;
  const contribution = {
    address: String(address),
    email: contributorEmail,
    amountUsd: String(amountUsd),
    txId: String(txId),
    at: Date.now(),
  };

  let current: BeamLink | null;

  if (relayerConfigured()) {
    // Serialize per link so concurrent contributions each get verified against
    // their own slice of the escrow balance (and never race a sweep).
    if (!(await acquireLinkLock(id)))
      return NextResponse.json(
        { error: "another payment is being verified — try again in a moment" },
        { status: 409 },
      );
    try {
      // Replay guard: the same settlement can't be counted twice.
      if (!(await markTxUsed(contribution.txId)))
        return NextResponse.json({ error: "tx already used" }, { status: 409 });

      const fresh = (await getLink(id)) ?? link;
      const credited = fresh.verifiedUsd ?? 0;
      const expected = credited + Number(amountUsd);
      const deposit = campaignDepositAddress(id);
      const balance = await waitForUsdcBalance(deposit!, expected - 0.01);
      if (balance + 0.01 < expected) {
        // Not landed yet — release the tx id so the client can retry.
        await unmarkTxUsed(contribution.txId);
        return NextResponse.json(
          {
            error: "payment not confirmed on Arbitrum yet — try again in a moment",
            escrowBalance: balance,
          },
          { status: 402 },
        );
      }

      // Verified on-chain: credit it.
      current = await addContribution(id, contribution);
      const raised = balance + (current?.withdrawnUsd ?? 0);
      const target = Number(fresh.amountUsd);
      const filled = fresh.direction === "split" && raised + 0.01 >= target;
      current =
        (await updateLink(id, {
          verifiedUsd: balance,
          ...(filled ? { status: "paid", paidAt: Date.now() } : {}),
        })) ?? current;

      // A split that just filled: sweep the escrow to the creator and record it.
      if (filled) {
        const swept = await sweepCampaignTo(id, fresh.senderAddress);
        if (swept.ok) {
          const remaining = await campaignBalanceUsd(id);
          current =
            (await updateLink(id, {
              withdrawnUsd:
                (current?.withdrawnUsd ?? 0) + (swept.amountUsd ?? balance),
              verifiedUsd: remaining,
              payoutTxId: swept.txHash,
            })) ?? current;
        }
      }
    } finally {
      await releaseLinkLock(id);
    }
  } else {
    // Local-dev fallback (production refuses above): self-reported settlement.
    if (!(await markTxUsed(contribution.txId)))
      return NextResponse.json({ error: "tx already used" }, { status: 409 });
    current = await addContribution(id, contribution);
    const filled =
      link.direction === "split" &&
      current != null &&
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
    // Reveal the product's content to the buyer whose payment just verified.
    unlocked: link.direction === "product" ? link.unlockUrl ?? null : null,
  });
}
