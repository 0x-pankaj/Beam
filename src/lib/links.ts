/**
 * Beam payment-link store + types.
 *
 * A "link" is a money request Alice creates and shares. Bob opens it, logs in
 * (capturing his address), and Alice's session pays it — settling on Arbitrum.
 *
 * Two interchangeable backends, auto-selected at runtime:
 *   • In-memory Map — local dev (`pnpm dev`, one Node process). Zero setup.
 *   • Redis REST   — Vercel KV or Upstash, used automatically when their env
 *                    vars are present. Required on serverless (each request can
 *                    hit a fresh instance, so memory doesn't persist).
 *
 * The API surface (create / get / listBySender / update) is identical for both,
 * so nothing else in the app changes.
 */

export type Reason = "rent" | "split" | "gift" | "tip" | "none";
export type LinkStatus = "pending" | "claiming" | "sending" | "paid";
/**
 * "send"    = creator pays the opener (walletless claim).
 * "request" = the opener pays the creator.
 * "split"   = many openers each pay a share to the creator until the total fills.
 */
export type Direction = "send" | "request" | "split";

/** One payment toward a split link. */
export type Contribution = {
  address: string;
  email?: string;
  amountUsd: string;
  txId: string;
  at: number;
};

export type BeamLink = {
  id: string;
  direction: Direction;
  amountUsd: string;
  reason: Reason;
  note?: string;
  /** The link's creator. For "send" they pay; for "request"/"split" they receive. */
  senderAddress: string;
  senderName?: string;
  status: LinkStatus;
  /** The other party (opener). For "send" they receive; for "request" they pay. */
  claimantAddress?: string;
  claimantEmail?: string;
  txId?: string;
  /** Split only: suggested number of payers (share = amountUsd / splitWays). */
  splitWays?: number;
  /** Split only: payments collected so far. */
  contributions?: Contribution[];
  createdAt: number;
  paidAt?: number;
};

/** Total collected for a split link. */
export const collectedUsd = (link: BeamLink): number =>
  (link.contributions ?? []).reduce((s, c) => s + Number(c.amountUsd), 0);

export const REASON_META: Record<Reason, { label: string; emoji: string }> = {
  rent: { label: "Rent", emoji: "🏠" },
  split: { label: "Split", emoji: "🍽️" },
  gift: { label: "Gift", emoji: "🎁" },
  tip: { label: "Tip", emoji: "💛" },
  none: { label: "Payment", emoji: "💸" },
};

export type CreateInput = Pick<
  BeamLink,
  | "direction"
  | "amountUsd"
  | "reason"
  | "note"
  | "senderAddress"
  | "senderName"
  | "splitWays"
>;

const DIRECTIONS: Direction[] = ["send", "request", "split"];
const normalizeDirection = (d: unknown): Direction =>
  DIRECTIONS.includes(d as Direction) ? (d as Direction) : "send";

interface LinkStore {
  create(input: CreateInput): Promise<BeamLink>;
  get(id: string): Promise<BeamLink | null>;
  listBySender(senderAddress: string): Promise<BeamLink[]>;
  update(id: string, patch: Partial<BeamLink>): Promise<BeamLink | null>;
  addContribution(id: string, c: Contribution): Promise<BeamLink | null>;
}

function genId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++)
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

function buildLink(input: CreateInput): BeamLink {
  const direction = normalizeDirection(input.direction);
  return {
    id: genId(),
    direction,
    amountUsd: input.amountUsd,
    reason: input.reason,
    note: input.note,
    senderAddress: input.senderAddress,
    senderName: input.senderName,
    status: "pending",
    ...(direction === "split"
      ? { splitWays: input.splitWays, contributions: [] }
      : {}),
    createdAt: Date.now(),
  };
}

/** Append a contribution to a split link and mark it paid once the total fills. */
function applyContribution(link: BeamLink, c: Contribution): BeamLink {
  const contributions = [...(link.contributions ?? []), c];
  const collected = contributions.reduce((s, x) => s + Number(x.amountUsd), 0);
  const filled = collected + 1e-9 >= Number(link.amountUsd);
  return {
    ...link,
    contributions,
    status: filled ? "paid" : link.status,
    paidAt: filled ? Date.now() : link.paidAt,
  };
}

/* ───────────────────────────── In-memory backend ────────────────────────── */

class MemoryStore implements LinkStore {
  private map = new Map<string, BeamLink>();

  async create(input: CreateInput) {
    const link = buildLink(input);
    this.map.set(link.id, link);
    return link;
  }
  async get(id: string) {
    return this.map.get(id) ?? null;
  }
  async listBySender(senderAddress: string) {
    const lower = senderAddress.toLowerCase();
    return [...this.map.values()]
      .filter((l) => l.senderAddress.toLowerCase() === lower)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async update(id: string, patch: Partial<BeamLink>) {
    const link = this.map.get(id);
    if (!link) return null;
    const next = { ...link, ...patch };
    this.map.set(id, next);
    return next;
  }
  async addContribution(id: string, c: Contribution) {
    const link = this.map.get(id);
    if (!link) return null;
    const next = applyContribution(link, c);
    this.map.set(id, next);
    return next;
  }
}

/* ───────────────────────────── Redis (Vercel KV / Upstash) ───────────────── */

function redisConfig() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

class RedisStore implements LinkStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private linkKey = (id: string) => `beam:link:${id}`;
  private senderKey = (addr: string) => `beam:sender:${addr.toLowerCase()}`;

  private async cmd<T = unknown>(command: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Redis ${command[0]} failed: ${res.status}`);
    const json = (await res.json()) as { result: T; error?: string };
    if (json.error) throw new Error(json.error);
    return json.result;
  }

  async create(input: CreateInput) {
    const link = buildLink(input);
    await this.cmd(["SET", this.linkKey(link.id), JSON.stringify(link)]);
    await this.cmd([
      "ZADD",
      this.senderKey(link.senderAddress),
      link.createdAt,
      link.id,
    ]);
    return link;
  }

  async get(id: string) {
    const raw = await this.cmd<string | null>(["GET", this.linkKey(id)]);
    return raw ? (JSON.parse(raw) as BeamLink) : null;
  }

  async listBySender(senderAddress: string) {
    const ids = await this.cmd<string[]>([
      "ZRANGE",
      this.senderKey(senderAddress),
      "0",
      "-1",
      "REV",
    ]);
    if (!ids?.length) return [];
    const raws = await this.cmd<(string | null)[]>([
      "MGET",
      ...ids.map((id) => this.linkKey(id)),
    ]);
    return raws
      .filter((r): r is string => !!r)
      .map((r) => JSON.parse(r) as BeamLink);
  }

  async update(id: string, patch: Partial<BeamLink>) {
    const link = await this.get(id);
    if (!link) return null;
    const next = { ...link, ...patch };
    await this.cmd(["SET", this.linkKey(id), JSON.stringify(next)]);
    return next;
  }
  async addContribution(id: string, c: Contribution) {
    const link = await this.get(id);
    if (!link) return null;
    const next = applyContribution(link, c);
    await this.cmd(["SET", this.linkKey(id), JSON.stringify(next)]);
    return next;
  }
}

/* ───────────────────────────── Selection ────────────────────────────────── */

// Persist the singleton across hot reloads / serverless module reuse.
const g = globalThis as unknown as { __beamStore?: LinkStore };

function getStore(): LinkStore {
  if (g.__beamStore) return g.__beamStore;
  const cfg = redisConfig();
  g.__beamStore = cfg ? new RedisStore(cfg.url, cfg.token) : new MemoryStore();
  return g.__beamStore;
}

export const createLink = (input: CreateInput) => getStore().create(input);
export const getLink = (id: string) => getStore().get(id);
export const listLinksBySender = (addr: string) =>
  getStore().listBySender(addr);
export const updateLink = (id: string, patch: Partial<BeamLink>) =>
  getStore().update(id, patch);
export const addContribution = (id: string, c: Contribution) =>
  getStore().addContribution(id, c);

/** True when a persistent backend is configured (for diagnostics). */
export const isPersistent = () => redisConfig() !== null;
