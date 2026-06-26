import { NextResponse } from "next/server";
import { getLink, updateLink } from "@/lib/links";

// The sender has approved and the cross-chain settlement is in flight.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.status === "paid") return NextResponse.json(link);
  const next = await updateLink(id, { status: "sending" });
  return NextResponse.json(next);
}
