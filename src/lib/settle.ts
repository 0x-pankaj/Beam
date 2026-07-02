/**
 * Client helper: report a settlement to the server and wait for it to verify
 * on-chain. Cross-chain settlements take a little while to land on Arbitrum,
 * so the server answers 402 (money not visible yet) or a retryable 409 (another
 * verification holds the link's lock) until it can prove the payment — we keep
 * re-reporting instead of failing the payer. Total patience ≈ 4 minutes on top
 * of the server's own polling; the funds are on-chain either way.
 */

const RETRY_DELAY_MS = 4000;
const MAX_ATTEMPTS = 12;

export async function settleReport<T = Record<string, unknown>>(
  path: string,
  payload: unknown,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.ok) return data;
    const retryable =
      res.status === 402 ||
      (res.status === 409 && String(data?.error ?? "").includes("try again"));
    if (!retryable || attempt >= MAX_ATTEMPTS - 1)
      throw new Error(
        data?.error ||
          "settlement not confirmed yet — your money is safe, retry in a moment",
      );
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
}
