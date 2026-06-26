import { NextRequest, NextResponse } from "next/server";
import { getLink, updateLink } from "@/lib/links";

// Bob announces he's claiming: records his address so the sender can pay him.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.status === "paid")
    return NextResponse.json({ error: "already paid" }, { status: 409 });

  const body = await req.json().catch(() => null);
  const claimantAddress = body?.claimantAddress;
  if (!claimantAddress)
    return NextResponse.json({ error: "missing claimant" }, { status: 400 });

  const next = updateLink(id, {
    status: "claiming",
    claimantAddress: String(claimantAddress),
    claimantEmail: body?.claimantEmail
      ? String(body.claimantEmail).slice(0, 80)
      : undefined,
  });
  return NextResponse.json(next);
}
