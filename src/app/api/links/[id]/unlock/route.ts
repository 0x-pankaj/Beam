import { NextRequest, NextResponse } from "next/server";
import { getLink, hasContributed } from "@/lib/links";

// Re-reveal a product's unlock content to an address that has already paid.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const address = req.nextUrl.searchParams.get("address");
  const link = await getLink(id);
  if (!link || link.direction !== "product")
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!address || !hasContributed(link, address))
    return NextResponse.json({ error: "not purchased" }, { status: 403 });
  return NextResponse.json({ url: link.unlockUrl ?? null });
}
