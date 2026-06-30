/**
 * Server-side input validation + escaping. The API treats all client input as
 * hostile: addresses, URLs, and tx hashes are format-checked before use, and any
 * user text rendered into an HTML email is escaped.
 */

import { isAddress } from "ethers";

/** A well-formed EVM address (checksummed or not). */
export const isEvmAddress = (v: unknown): v is string =>
  typeof v === "string" && isAddress(v);

/** A 32-byte 0x tx hash. */
export const isTxHash = (v: unknown): v is string =>
  typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);

/** An http(s) URL, returned normalized, or null if invalid. */
export function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A plausible email address. */
export const isEmail = (v: unknown): v is string =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Escape user text before interpolating into an HTML template. */
export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
