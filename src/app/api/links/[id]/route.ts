import { NextResponse } from "next/server";
import { getLink, isCampaign, publicLink } from "@/lib/links";
import { campaignDepositAddress } from "@/lib/relayer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Campaign links carry their escrow deposit address so contributors pay into
  // the verifiable per-campaign address (falls back to direct when unconfigured).
  const escrowAddress = isCampaign(link.direction)
    ? campaignDepositAddress(id) ?? undefined
    : undefined;
  return NextResponse.json({ ...publicLink(link), escrowAddress });
}
