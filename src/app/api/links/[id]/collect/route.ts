import { NextRequest, NextResponse } from "next/server";
import { getLink, updateLink, isCampaign } from "@/lib/links";
import { isEvmAddress } from "@/lib/validate";
import { relayerConfigured, sweepCampaignTo, campaignBalanceUsd } from "@/lib/relayer";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// The creator collects (withdraws) a campaign's verified escrow balance to their
// own address on Arbitrum. Works for fund/product (ongoing) and any leftover.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(req, "collect", 15)) return tooMany();
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isCampaign(link.direction))
    return NextResponse.json({ error: "not a campaign link" }, { status: 400 });
  if (!relayerConfigured())
    return NextResponse.json({ error: "escrow not configured" }, { status: 503 });
  if (!isEvmAddress(link.senderAddress))
    return NextResponse.json({ error: "bad creator address" }, { status: 400 });

  const swept = await sweepCampaignTo(id, link.senderAddress);
  if (!swept.ok)
    return NextResponse.json(
      { error: swept.error || "collect failed" },
      { status: swept.error === "nothing to collect" ? 409 : 502 },
    );

  const remaining = await campaignBalanceUsd(id);
  const next = await updateLink(id, {
    withdrawnUsd: (link.withdrawnUsd ?? 0) + (swept.amountUsd ?? 0),
    verifiedUsd: remaining,
  });
  return NextResponse.json({ ok: true, txHash: swept.txHash, amountUsd: swept.amountUsd, link: next });
}
