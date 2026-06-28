import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

// Optionally email a payment link to its recipient via Resend.
// No-ops cleanly when RESEND_API_KEY isn't configured, so the app works without it.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { to, url, amountUsd, fromName, direction } = body ?? {};
  if (!to || !url)
    return NextResponse.json({ error: "to and url required" }, { status: 400 });

  const who = fromName || "Someone";
  const amount = amountUsd ? `$${Number(amountUsd).toLocaleString()}` : "money";
  const subject =
    direction === "request"
      ? `${who} is requesting ${amount} on Beam`
      : `${who} sent you ${amount} on Beam`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2>${subject}</h2>
      <p>Claim it with a tap — no wallet, no seed phrase. Settles on Arbitrum.</p>
      <p><a href="${url}" style="display:inline-block;background:#7c5cff;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open on Beam</a></p>
      <p style="color:#888;font-size:12px">${url}</p>
    </div>`;

  const sent = await sendEmail({ to: String(to), subject, html });
  return NextResponse.json({ sent });
}
