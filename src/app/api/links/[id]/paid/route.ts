import { NextRequest, NextResponse, after } from "next/server";
import { getLink, updateLink, REASON_META } from "@/lib/links";
import { notifyCreatorPaid } from "@/lib/email";
import { short } from "@/lib/format";

// The sender reports the settled UA transaction, marking the link paid.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await getLink(id);
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const txId = body?.txId;
  if (!txId) return NextResponse.json({ error: "missing txId" }, { status: 400 });

  const next = await updateLink(id, {
    status: "paid",
    txId: String(txId),
    paidAt: Date.now(),
  });

  // For a request link, the opener just paid the creator — notify the creator.
  if (link.direction === "request") {
    after(() =>
      notifyCreatorPaid({
        to: link.senderName,
        amountUsd: link.amountUsd,
        what: link.note || REASON_META[link.reason].label,
        fromLabel: link.claimantEmail || short(link.claimantAddress),
      }),
    );
  }

  return NextResponse.json(next);
}
