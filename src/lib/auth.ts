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
