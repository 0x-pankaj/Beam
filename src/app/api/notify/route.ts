import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { isEmail, safeUrl, escapeHtml } from "@/lib/validate";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// Optionally email a payment link to its recipient via Resend.
// No-ops cleanly when RESEND_API_KEY isn't configured, so the app works without it.
export async function POST(req: NextRequest) {
  if (!rateLimit(req, "notify", 15)) return tooMany();
  const body = await req.json().catch(() => null);
  const { to, url, amountUsd, fromName, direction } = body ?? {};
  const safeLink = safeUrl(url);
  if (!isEmail(to) || !safeLink)
    return NextResponse.json({ error: "valid email and url required" }, { status: 400 });

  const who = fromName ? String(fromName).slice(0, 60) : "Someone";
  const amount = amountUsd ? `$${Number(amountUsd).toLocaleString()}` : "money";
  const subject =
    direction === "request"
      ? `${who} is requesting ${amount} on Beam`
      : `${who} sent you ${amount} on Beam`;
  const href = escapeHtml(safeLink);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2>${escapeHtml(subject)}</h2>
      <p>Claim it with a tap — no wallet, no seed phrase. Settles on Arbitrum.</p>
      <p><a href="${href}" style="display:inline-block;background:#7c5cff;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open on Beam</a></p>
      <p style="color:#888;font-size:12px">${href}</p>
    </div>`;

  const sent = await sendEmail({ to: String(to), subject, html });
  return NextResponse.json({ sent });
}
