import { NextRequest, NextResponse } from "next/server";
import {
  createLink,
  listLinksBySender,
  publicLink,
  type Reason,
} from "@/lib/links";

const REASONS: Reason[] = ["rent", "split", "gift", "tip", "none"];

// Create a payment link / campaign / product.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const {
    direction,
    amountUsd,
    reason,
    note,
    title,
    unlockUrl,
    senderAddress,
    senderName,
    splitWays,
  } = body;
  if (!amountUsd || Number(amountUsd) <= 0)
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  if (!senderAddress)
    return NextResponse.json({ error: "missing sender" }, { status: 400 });

  const ways = Number(splitWays);
  const link = await createLink({
    direction, // normalized inside the store
    amountUsd: String(amountUsd),
    reason: REASONS.includes(reason) ? reason : "none",
    note: note ? String(note).slice(0, 140) : undefined,
    title: title ? String(title).slice(0, 80) : undefined,
    unlockUrl: unlockUrl ? String(unlockUrl).slice(0, 500) : undefined,
    senderAddress: String(senderAddress),
    senderName: senderName ? String(senderName).slice(0, 40) : undefined,
    splitWays: Number.isFinite(ways) && ways >= 2 ? Math.floor(ways) : undefined,
  });
  // Echo back the creator's own link incl. unlockUrl so they can see what they set.
  return NextResponse.json(link);
}

// List the links created by a given sender (for the dashboard / activity feed).
export async function GET(req: NextRequest) {
  const sender = req.nextUrl.searchParams.get("sender");
  if (!sender)
    return NextResponse.json({ error: "missing sender" }, { status: 400 });
  const links = await listLinksBySender(sender);
  return NextResponse.json(links.map(publicLink));
}
