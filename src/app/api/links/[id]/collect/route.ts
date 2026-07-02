import { NextRequest, NextResponse } from "next/server";
import {
  acquireLinkLock,
  getLink,
  isCampaign,
  releaseLinkLock,
  updateLink,
} from "@/lib/links";
import { verifyLinkAction } from "@/lib/auth";
import { isEvmAddress } from "@/lib/validate";
import { relayerConfigured, sweepCampaignTo, campaignBalanceUsd } from "@/lib/relayer";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// Sweeping waits for on-chain confirmations (gas top-up + transfer).
export const maxDuration = 60;

// The creator collects (withdraws) a campaign's verified escrow balance to their
// own address on Arbitrum. Works for fund/product (ongoing) and any leftover.
// Creator-only: the request must be signed by senderAddress.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await rateLimit(req, "collect", 15))) return tooMany();
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!isCampaign(link.direction))
    return NextResponse.json({ error: "not a campaign link" }, { status: 400 });
  if (!relayerConfigured())
    return NextResponse.json({ error: "escrow not configured" }, { status: 503 });
  if (!isEvmAddress(link.senderAddress))
    return NextResponse.json({ error: "bad creator address" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!verifyLinkAction("collect", id, link.senderAddress, body))
    return NextResponse.json(
      { error: "collect must be signed by the creator" },
      { status: 403 },
    );

  // Serialize with contribution verification so a sweep never runs mid-verify
  // (a contributor's deposit would otherwise be swept before it was credited).
  if (!(await acquireLinkLock(id)))
    return NextResponse.json(
      { error: "settlement already in flight — try again in a moment" },
      { status: 409 },
    );
  try {
    const swept = await sweepCampaignTo(id, link.senderAddress);
    if (!swept.ok)
      return NextResponse.json(
        { error: swept.error || "collect failed" },
        { status: swept.error === "nothing to collect" ? 409 : 502 },
      );

    const remaining = await campaignBalanceUsd(id);
    const fresh = await getLink(id);
    const next = await updateLink(id, {
      withdrawnUsd: ((fresh ?? link).withdrawnUsd ?? 0) + (swept.amountUsd ?? 0),
      verifiedUsd: remaining,
    });
    return NextResponse.json({
      ok: true,
      txHash: swept.txHash,
      amountUsd: swept.amountUsd,
      link: next,
    });
  } finally {
    await releaseLinkLock(id);
  }
}
