/**
 * Beam payment-link store + types.
 *
 * A "link" is a money request Alice creates and shares. Bob opens it, logs in
 * (capturing his address), and Alice's session pays it — settling on Arbitrum.
 *
 * NOTE: this is an in-process Map. It persists across requests in `pnpm dev`
 * (single Node process) — perfect for local demos. On Vercel's serverless
 * runtime it won't persist across instances; swap `store` for Vercel KV /
 * Upstash there. The API surface below is the only thing that needs to change.
 */

export type Reason = "rent" | "split" | "gift" | "tip" | "none";
export type LinkStatus = "pending" | "claiming" | "paid";

export type BeamLink = {
  id: string;
  amountUsd: string;
  reason: Reason;
  note?: string;
  senderAddress: string;
  senderName?: string;
  status: LinkStatus;
  claimantAddress?: string;
  claimantEmail?: string;
  txId?: string;
  createdAt: number;
  paidAt?: number;
};

export const REASON_META: Record<
  Reason,
  { label: string; emoji: string }
> = {
  rent: { label: "Rent", emoji: "🏠" },
  split: { label: "Split", emoji: "🍽️" },
  gift: { label: "Gift", emoji: "🎁" },
  tip: { label: "Tip", emoji: "💛" },
  none: { label: "Payment", emoji: "💸" },
};

const store = new Map<string, BeamLink>();

function genId(): string {
  // URL-safe, short, collision-resistant enough for a demo.
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return store.has(id) ? genId() : id;
}

export function createLink(
  input: Pick<
    BeamLink,
    "amountUsd" | "reason" | "note" | "senderAddress" | "senderName"
  >,
): BeamLink {
  const link: BeamLink = {
    id: genId(),
    amountUsd: input.amountUsd,
    reason: input.reason,
    note: input.note,
    senderAddress: input.senderAddress,
    senderName: input.senderName,
    status: "pending",
    createdAt: Date.now(),
  };
  store.set(link.id, link);
  return link;
}

export function getLink(id: string): BeamLink | undefined {
  return store.get(id);
}

export function listLinksBySender(senderAddress: string): BeamLink[] {
  const lower = senderAddress.toLowerCase();
  return [...store.values()]
    .filter((l) => l.senderAddress.toLowerCase() === lower)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function updateLink(
  id: string,
  patch: Partial<BeamLink>,
): BeamLink | undefined {
  const link = store.get(id);
  if (!link) return undefined;
  const next = { ...link, ...patch };
  store.set(id, next);
  return next;
}
