import { NextRequest, NextResponse, after } from "next/server";
import { getLink, updateLink, markTxUsed, REASON_META } from "@/lib/links";
import { notifyCreatorPaid } from "@/lib/email";
import { short } from "@/lib/format";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// The payer reports the settled UA transaction (a peer-to-peer transfer to the
// creator), marking the link paid. The UA SDK exposes only an opaque activity
// id, not a destination hash, so we can't verify the receipt server-side; we do
// guard against replay (the same activity id can't settle two links) and ignore
// stale reports for an already-finalized link.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!rateLimit(req, "paid", 20)) return tooMany();
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.status === "paid")
    return NextResponse.json(link); // already finalized

  const body = await req.json().catch(() => null);
  const txId = body?.txId;
  if (!txId || typeof txId !== "string")
    return NextResponse.json({ error: "missing txId" }, { status: 400 });
  if (!(await markTxUsed(txId)))
    return NextResponse.json({ error: "tx already used" }, { status: 409 });

  const next = await updateLink(id, {
    status: "paid",
    txId: String(txId),
    paidAt: Date.now(),
  });

  // For a request link, the opener just paid the creator — notify the creator.
  if (link.direction === "request") {
    after(() =>
      notifyCreatorPaid({
        to: link.senderEmail ?? link.senderName,
        amountUsd: link.amountUsd,
        what: link.note || REASON_META[link.reason].label,
        fromLabel: link.claimantEmail || short(link.claimantAddress),
      }),
    );
  }

  return NextResponse.json(next);
}
