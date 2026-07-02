/**
 * Lightweight ownership auth: the client proves it controls an address by
 * signing a message with the Magic EOA; the server recovers the signer and
 * checks it matches. Used to stop anyone from claiming a @handle for an address
 * they don't own.
 */

import { verifyMessage } from "ethers";

/** The exact message a user signs to claim a handle. Must match on both sides. */
export const usernameClaimMessage = (name: string, address: string) =>
  `Beam username claim\nhandle: ${name.trim().toLowerCase()}\naddress: ${address.toLowerCase()}`;

/**
 * The message a link's creator signs to authorize a money-moving action on it
 * (refund / collect). The timestamp bounds replay; must match on both sides.
 */
export const linkActionMessage = (
  action: "refund" | "collect",
  linkId: string,
  address: string,
  ts: number,
) =>
  `Beam ${action}\nlink: ${linkId}\naddress: ${address.toLowerCase()}\nts: ${ts}`;

/** How long a signed link action stays valid. */
const LINK_ACTION_WINDOW_MS = 10 * 60_000;

/**
 * Verify a signed refund/collect request: the signature must be fresh and
 * produced by the link's creator address. `body` is the raw request JSON.
 */
export function verifyLinkAction(
  action: "refund" | "collect",
  linkId: string,
  creatorAddress: string,
  body: { ts?: unknown; signature?: unknown } | null,
): boolean {
  const ts = Number(body?.ts);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > LINK_ACTION_WINDOW_MS)
    return false;
  return verifySigner(
    linkActionMessage(action, linkId, creatorAddress, ts),
    body?.signature,
    creatorAddress,
  );
}

/** True when `signature` over `message` was produced by `address`. */
export function verifySigner(
  message: string,
  signature: unknown,
  address: string,
): boolean {
  if (typeof signature !== "string" || !signature) return false;
  try {
    return verifyMessage(message, signature).toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}
