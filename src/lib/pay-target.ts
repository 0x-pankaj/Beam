import { getAddress, isAddress } from "ethers";
import { resolveEns } from "./ens";

/** What a scanned/typed payment target resolves to. */
export type ScanResult =
  | { kind: "route"; path: string } // a Beam link → navigate
  | { kind: "address"; address: string; amount?: string }
  | { kind: "ens"; name: string }
  | { kind: "unknown" };

const ENS_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i;

// Plain boolean wrapper so ethers' `value is string` guard doesn't narrow our
// string variables to `never` in the negative branch.
const isAddr = (v: string): boolean => isAddress(v);

/**
 * Interpret a scanned QR (or pasted string):
 * - a Beam URL on this origin → route to /claim/… or /u/…
 * - an `ethereum:0x…` EIP-681 URI → address (+ optional amount)
 * - a bare 0x… address
 * - a *.eth ENS name
 */
export function parseScan(raw: string, origin?: string): ScanResult {
  const s = raw.trim();

  // Beam link (full URL on our origin).
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const here = origin ? new URL(origin).host : undefined;
      if ((!here || u.host === here) && /^\/(claim|u)\//.test(u.pathname)) {
        return { kind: "route", path: u.pathname + u.search };
      }
    } catch {
      /* not a URL we handle */
    }
  }

  // EIP-681: ethereum:0xabc...@chain?value=...  or  ethereum:0xabc...
  const eip681 = s.match(/^ethereum:(0x[a-fA-F0-9]{40})(?:@\d+)?(?:\?(.*))?$/i);
  if (eip681 && isAddress(eip681[1])) {
    const params = new URLSearchParams(eip681[2] ?? "");
    const amount = params.get("amount") ?? params.get("value") ?? undefined;
    return {
      kind: "address",
      address: getAddress(eip681[1]),
      amount: amount && /^[0-9.]+$/.test(amount) ? amount : undefined,
    };
  }

  if (isAddr(s)) return { kind: "address", address: getAddress(s) };
  if (ENS_RE.test(s)) return { kind: "ens", name: s.toLowerCase() };
  return { kind: "unknown" };
}

/** Resolve a typed/scanned recipient (0x or ENS) to a checksummed address. */
export async function resolveRecipient(
  input: string,
): Promise<{ address: string; label: string }> {
  const s = input.trim();
  if (isAddr(s)) return { address: getAddress(s), label: s };
  if (ENS_RE.test(s)) {
    const addr = await resolveEns(s);
    if (!addr) throw new Error(`Couldn't resolve ${s}`);
    return { address: getAddress(addr), label: s };
  }
  throw new Error("Enter a valid wallet address or ENS name");
}
