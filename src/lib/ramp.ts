/**
 * Fiat on-ramp / off-ramp via Particle Network's hosted ramp.
 *
 * Why Particle (not Magic or Circle):
 *  • Magic's on-ramp only supports Ethereum + Polygon (NOT Arbitrum) and forces
 *    its own wallet widget — we use Magic headlessly, so it doesn't fit.
 *  • Circle has no consumer card→fiat ramp (it's USDC plumbing).
 *  • Particle's ramp does buy AND sell, settles to any address on Arbitrum, needs
 *    no new SDK or key (just a URL), and reinforces the Universal Accounts story.
 *
 * It's a hosted, KYC-compliant widget — exactly how real apps do fiat (you never
 * build the rails yourself). We deep-link into it with the user's address so
 * bought USDC lands in their Beam account, and cash-outs sell their USDC.
 *
 * Docs: https://ramp.particle.network · params: fiatCoin, cryptoCoin, network,
 * fiatAmt, cryptAmt, walletAddress, theme, language.
 */

const RAMP_BASE = "https://ramp.particle.network/";

/** Particle ramp's network label for Arbitrum One. The widget also lets the user
 * switch networks, so this is a preselect, not a hard requirement. */
export const RAMP_NETWORK = "Arbitrum One";
export const RAMP_CRYPTO = "USDC";

/** Buy USDC with fiat, delivered to `address` on Arbitrum. */
export function onRampUrl(address?: string | null, fiatAmt?: number): string {
  const p = new URLSearchParams({
    fiatCoin: "USD",
    cryptoCoin: RAMP_CRYPTO,
    network: RAMP_NETWORK,
    theme: "light",
    language: "en",
  });
  if (address) p.set("walletAddress", address);
  if (fiatAmt && fiatAmt > 0) p.set("fiatAmt", String(fiatAmt));
  return `${RAMP_BASE}?${p.toString()}`;
}

/** Sell (cash out) USDC from `address` on Arbitrum to fiat. */
export function offRampUrl(address?: string | null, cryptAmt?: number): string {
  const p = new URLSearchParams({
    fiatCoin: "USD",
    cryptoCoin: RAMP_CRYPTO,
    network: RAMP_NETWORK,
    theme: "light",
    language: "en",
  });
  if (address) p.set("walletAddress", address);
  if (cryptAmt && cryptAmt > 0) p.set("cryptAmt", String(cryptAmt));
  return `${RAMP_BASE}?${p.toString()}`;
}
