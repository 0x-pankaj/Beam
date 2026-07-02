import { NextRequest, NextResponse, after } from "next/server";
import {
  acquireLinkLock,
  getLink,
  isCampaign,
  markTxUsed,
  releaseLinkLock,
  unmarkTxUsed,
  updateLink,
  REASON_META,
} from "@/lib/links";
import {
  campaignDepositAddress,
  relayerConfigured,
  sweepCampaignTo,
} from "@/lib/relayer";
import { waitForUsdcBalance } from "@/lib/arbitrum";
import { requireProductionReady } from "@/lib/guard";
import { notifyCreatorPaid } from "@/lib/email";
import { short } from "@/lib/format";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// On-chain verification + forwarding wait for confirmations.
export const maxDuration = 60;

// The payer settled a request link. With the relayer configured (production),
// the payment went into the link's own escrow deposit address, so we VERIFY it
// on-chain — the link is only marked paid once the USDC is really there — and
// then forward it to the creator, recording the real Arbitrum tx hash. Without
// a relayer (local dev only; production refuses), we fall back to recording the
// client-reported settlement, replay-guarded by its opaque UA activity id.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await rateLimit(req, "paid", 20))) return tooMany();
  const notReady = requireProductionReady();
  if (notReady) return notReady;
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.status === "paid")
    return NextResponse.json(link); // already finalized
  if (isCampaign(link.direction))
    return NextResponse.json(
      { error: "campaign links settle via contribute" },
      { status: 400 },
    );

  const body = await req.json().catch(() => null);
  const txId = body?.txId;
  if (!txId || typeof txId !== "string")
    return NextResponse.json({ error: "missing txId" }, { status: 400 });

  // Send links settle through the escrow (fund → claim) when the relayer is
  // up — a bare "I paid them" report must not be able to mark one paid.
  if (link.direction === "send" && relayerConfigured())
    return NextResponse.json(
      { error: "send links settle via escrow (fund + claim)" },
      { status: 409 },
    );

  if (!(await markTxUsed(txId)))
    return NextResponse.json({ error: "tx already used" }, { status: 409 });

  if (link.direction === "request" && relayerConfigured()) {
    if (!(await acquireLinkLock(id))) {
      await unmarkTxUsed(txId);
      return NextResponse.json(
        { error: "settlement already in flight — try again in a moment" },
        { status: 409 },
      );
    }
    try {
      const fresh = await getLink(id);
      if (!fresh || fresh.status === "paid") {
        await unmarkTxUsed(txId);
        return NextResponse.json(fresh ?? link);
      }
      const deposit = campaignDepositAddress(id);
      const amount = Number(fresh.amountUsd);
      const balance = await waitForUsdcBalance(deposit!, amount - 0.01);
      if (balance + 0.01 < amount) {
        // Cross-chain settlement hasn't landed yet — let the client retry.
        await unmarkTxUsed(txId);
        return NextResponse.json(
          {
            error: "payment not confirmed on Arbitrum yet — try again in a moment",
            escrowBalance: balance,
          },
          { status: 402 },
        );
      }

      // Verified: forward the escrowed USDC to the creator.
      const swept = await sweepCampaignTo(id, fresh.senderAddress);
      if (!swept.ok) {
        await unmarkTxUsed(txId);
        return NextResponse.json(
          { error: swept.error || "forwarding to creator failed" },
          { status: 502 },
        );
      }

      const next = await updateLink(id, {
        status: "paid",
        txId: swept.txHash,
        payoutTxId: swept.txHash,
        fundTxId: String(txId).slice(0, 120),
        paidAt: Date.now(),
      });
      after(() =>
        notifyCreatorPaid({
          to: fresh.senderEmail ?? fresh.senderName,
          amountUsd: fresh.amountUsd,
          what: fresh.note || REASON_META[fresh.reason].label,
          fromLabel: fresh.claimantEmail || short(fresh.claimantAddress),
        }),
      );
      return NextResponse.json(next);
    } finally {
      await releaseLinkLock(id);
    }
  }

  // Legacy/dev fallback — record the client-reported settlement.
  const next = await updateLink(id, {
    status: "paid",
    txId: String(txId),
    paidAt: Date.now(),
  });

  if (link.direction === "request") {
    after(() =>
      notifyCreatorPaid({
        to: link.senderEmail ?? link.senderName,
        amountUsd: link.amountUsd,
        what: link.note || REASON_META[link.reason].label,
        fromLabel: link.claimantEmail || short(link.claimantAddress),
      }),
    );
  }

  return NextResponse.json(next);
}
