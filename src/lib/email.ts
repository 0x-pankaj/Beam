// Email via Resend (optional). All helpers no-op safely when RESEND_API_KEY is
// unset or the recipient isn't an email, so the app works without configuration.

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "Beam <onboarding@resend.dev>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://beam-encoder.vercel.app";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!KEY || !opts.to || !opts.to.includes("@")) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#7c5cff;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">${label}</a>`;

/** "💰 You got paid" — notify a creator when money lands (request/split/fund/product). */
export async function notifyCreatorPaid(opts: {
  to?: string;
  amountUsd: string;
  what?: string;
  fromLabel?: string;
}): Promise<void> {
  if (!opts.to) return;
  const amount = `$${Number(opts.amountUsd).toLocaleString()}`;
  const subject = `💰 You got paid ${amount} on Beam`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2>${subject}</h2>
      <p>${opts.fromLabel ? `${opts.fromLabel} paid you ` : "You received "}${amount}${
        opts.what ? ` for <b>${opts.what}</b>` : ""
      } — settled on Arbitrum.</p>
      <p>${button(APP_URL, "Open Beam")}</p>
    </div>`;
  await sendEmail({ to: opts.to, subject, html });
}
