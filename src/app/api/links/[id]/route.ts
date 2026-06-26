import { NextResponse } from "next/server";
import { getLink } from "@/lib/links";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(link);
}
