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
  // Campaign and request links carry their escrow deposit address so payers pay
  // into the verifiable per-link address — the server can then prove the money
  // landed before marking anything paid (falls back to direct when unconfigured).
  const escrowAddress =
    isCampaign(link.direction) || link.direction === "request"
      ? campaignDepositAddress(id) ?? undefined
      : undefined;
  return NextResponse.json({ ...publicLink(link), escrowAddress });
}
