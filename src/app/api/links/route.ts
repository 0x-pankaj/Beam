import { NextRequest, NextResponse } from "next/server";
import {
  createLink,
  listLinksBySender,
  type Reason,
} from "@/lib/links";

const REASONS: Reason[] = ["rent", "split", "gift", "tip", "none"];

// Create a payment link.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const { amountUsd, reason, note, senderAddress, senderName } = body;
  if (!amountUsd || Number(amountUsd) <= 0)
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  if (!senderAddress)
    return NextResponse.json({ error: "missing sender" }, { status: 400 });

  const link = await createLink({
    amountUsd: String(amountUsd),
    reason: REASONS.includes(reason) ? reason : "none",
    note: note ? String(note).slice(0, 140) : undefined,
    senderAddress: String(senderAddress),
    senderName: senderName ? String(senderName).slice(0, 40) : undefined,
  });
  return NextResponse.json(link);
}

// List the links created by a given sender (for the dashboard / activity feed).
export async function GET(req: NextRequest) {
  const sender = req.nextUrl.searchParams.get("sender");
  if (!sender)
    return NextResponse.json({ error: "missing sender" }, { status: 400 });
  return NextResponse.json(await listLinksBySender(sender));
}
