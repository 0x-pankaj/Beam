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
/**
 * pending  = created, not yet funded (send) / not yet paid (request/campaign).
 * funded   = escrow holds the money (send only) — payout to claimant is guaranteed.
 * claiming = recipient opened the link and recorded their address.
 * sending  = settlement in flight.
 * paid     = settled on Arbitrum to the recipient.
 * refunded = escrow returned to the sender (unclaimed/expired send link).
 * expired  = past its claim window (no longer claimable).
 */
export type LinkStatus =
  | "pending"
  | "funded"
  | "claiming"
  | "sending"
  | "paid"
  | "refunded"
  | "expired";
/**
 * "send"    = creator pays the opener (walletless claim).
 * "request" = the opener pays the creator.
 * "split"   = many openers each pay a share to the creator until the total fills.
 * "fund"    = crowdfund: many backers pay any amount toward a goal (stays open).
 * "product" = sell: many buyers each pay a fixed price; pays unlock content.
 */
export type Direction = "send" | "request" | "split" | "fund" | "product";

/** Directions where many people pay one creator (reuse the contributions engine). */
export const isCampaign = (d: Direction) =>
  d === "split" || d === "fund" || d === "product";

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
  /** amount (send/request) · goal (fund) · unit price (product) · total (split). */
  amountUsd: string;
  reason: Reason;
  note?: string;
  /** Campaign/product display name (fund/product). */
  title?: string;
  /** Product only: secret content revealed to a buyer after they pay. */
  unlockUrl?: string;
  /** The link's creator. For "send" they pay; otherwise they receive. */
  senderAddress: string;
  senderName?: string;
  /** Creator's email — so we can tell them "you got paid". */
  senderEmail?: string;
  status: LinkStatus;
  /** The other party (opener). For "send" they receive; for "request" they pay. */
  claimantAddress?: string;
  claimantEmail?: string;
  txId?: string;
  /** Send/escrow: the sender's deposit tx into the relayer (locks the funds). */
  fundTxId?: string;
  /** Send/escrow: the relayer's payout tx to the recipient on Arbitrum. */
  payoutTxId?: string;
  /** Split only: suggested number of payers (share = amountUsd / splitWays). */
  splitWays?: number;
  /** Campaign payments collected so far (split/fund/product). */
  contributions?: Contribution[];
  /** Campaign escrow: last verified on-chain USDC balance of the deposit address. */
  verifiedUsd?: number;
  /** Campaign escrow: total already swept out to the creator. */
  withdrawnUsd?: number;
  /** Response-only: the per-campaign escrow deposit address (derived, not stored). */
  escrowAddress?: string;
  createdAt: number;
  paidAt?: number;
};

/** Total collected from self-reported contributions (fallback when unverified). */
export const collectedUsd = (link: BeamLink): number =>
  (link.contributions ?? []).reduce((s, c) => s + Number(c.amountUsd), 0);

/**
 * The amount a campaign has raised. Prefers the on-chain VERIFIED balance
 * (current escrow balance + already-withdrawn) over self-reported sums.
 */
export const campaignRaisedUsd = (link: BeamLink): number =>
  link.verifiedUsd != null
    ? link.verifiedUsd + (link.withdrawnUsd ?? 0)
    : collectedUsd(link);

/** Has this address already paid toward a link (case-insensitive). */
export const hasContributed = (link: BeamLink, address: string): boolean =>
  (link.contributions ?? []).some(
    (c) => c.address.toLowerCase() === address.toLowerCase(),
  );

/** Public view of a link — never leaks the product's unlock content. */
export const publicLink = (link: BeamLink): BeamLink => {
  const { unlockUrl: _unlock, ...rest } = link;
  void _unlock;
  return rest;
};

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
  | "title"
  | "unlockUrl"
  | "senderAddress"
  | "senderName"
  | "senderEmail"
  | "splitWays"
>;

const DIRECTIONS: Direction[] = [
  "send",
  "request",
  "split",
  "fund",
  "product",
];
const normalizeDirection = (d: unknown): Direction =>
  DIRECTIONS.includes(d as Direction) ? (d as Direction) : "send";

/** Reusable "@handle" — a permanent pay-me link at /u/<name>. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const normUsername = (n: string) => n.trim().toLowerCase();
export type ClaimResult = { ok: boolean; error?: string; username?: string };

interface LinkStore {
  create(input: CreateInput): Promise<BeamLink>;
  get(id: string): Promise<BeamLink | null>;
  listBySender(senderAddress: string): Promise<BeamLink[]>;
  update(id: string, patch: Partial<BeamLink>): Promise<BeamLink | null>;
  addContribution(id: string, c: Contribution): Promise<BeamLink | null>;
  /** Atomically claim a settled tx id. False if it was already used (replay). */
  markTxUsed(txId: string): Promise<boolean>;
  /** Atomically add to the escrow's reserved (locked) total; returns the new total. */
  reserveEscrow(amountUsd: number): Promise<number>;
  /** Current reserved (locked, unpaid) escrow total across all funded links. */
  getReservedEscrow(): Promise<number>;
  claimUsername(address: string, name: string): Promise<ClaimResult>;
  usernameToAddress(name: string): Promise<string | null>;
  addressToUsername(address: string): Promise<string | null>;
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
    ...(direction === "fund" || direction === "product"
      ? { title: input.title, unlockUrl: input.unlockUrl }
      : {}),
    senderAddress: input.senderAddress,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    status: "pending",
    ...(isCampaign(direction)
      ? { splitWays: direction === "split" ? input.splitWays : undefined, contributions: [] }
      : {}),
    createdAt: Date.now(),
  };
}

/**
 * Append a contribution. The close/fill decision is made by the contribute
 * route against the VERIFIED on-chain escrow balance (or self-reported sums when
 * no relayer is configured), so this just records the payment.
 */
function applyContribution(link: BeamLink, c: Contribution): BeamLink {
  return { ...link, contributions: [...(link.contributions ?? []), c] };
}

/* ───────────────────────────── In-memory backend ────────────────────────── */

class MemoryStore implements LinkStore {
  private map = new Map<string, BeamLink>();
  private unameToAddr = new Map<string, string>();
  private addrToUname = new Map<string, string>();
  private usedTx = new Set<string>();
  private reserved = 0;

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
  async markTxUsed(txId: string) {
    const k = txId.toLowerCase();
    if (this.usedTx.has(k)) return false;
    this.usedTx.add(k);
    return true;
  }
  async reserveEscrow(amountUsd: number) {
    this.reserved = Math.max(0, this.reserved + amountUsd);
    return this.reserved;
  }
  async getReservedEscrow() {
    return this.reserved;
  }
  async claimUsername(address: string, name: string) {
    const n = normUsername(name);
    if (!USERNAME_RE.test(n))
      return { ok: false, error: "3–20 chars: a–z, 0–9, _" };
    const owner = this.unameToAddr.get(n);
    if (owner && owner.toLowerCase() !== address.toLowerCase())
      return { ok: false, error: "That handle is taken" };
    const prev = this.addrToUname.get(address.toLowerCase());
    if (prev && prev !== n) this.unameToAddr.delete(prev);
    this.unameToAddr.set(n, address);
    this.addrToUname.set(address.toLowerCase(), n);
    return { ok: true, username: n };
  }
  async usernameToAddress(name: string) {
    return this.unameToAddr.get(normUsername(name)) ?? null;
  }
  async addressToUsername(address: string) {
    return this.addrToUname.get(address.toLowerCase()) ?? null;
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
  private unameKey = (n: string) => `beam:uname:${n}`;
  private addrNameKey = (addr: string) => `beam:addrname:${addr.toLowerCase()}`;

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
  async markTxUsed(txId: string) {
    // SET key value NX → "OK" when newly set, null when it already existed.
    const res = await this.cmd<string | null>([
      "SET",
      `beam:tx:${txId.toLowerCase()}`,
      "1",
      "NX",
    ]);
    return res === "OK";
  }
  async reserveEscrow(amountUsd: number) {
    const res = await this.cmd<string | number>([
      "INCRBYFLOAT",
      "beam:escrow:reserved",
      amountUsd,
    ]);
    return Number(res);
  }
  async getReservedEscrow() {
    const res = await this.cmd<string | null>(["GET", "beam:escrow:reserved"]);
    return res ? Number(res) : 0;
  }
  async claimUsername(address: string, name: string) {
    const n = normUsername(name);
    if (!USERNAME_RE.test(n))
      return { ok: false, error: "3–20 chars: a–z, 0–9, _" };
    const owner = await this.cmd<string | null>(["GET", this.unameKey(n)]);
    if (owner && owner.toLowerCase() !== address.toLowerCase())
      return { ok: false, error: "That handle is taken" };
    const prev = await this.cmd<string | null>([
      "GET",
      this.addrNameKey(address),
    ]);
    if (prev && prev !== n) await this.cmd(["DEL", this.unameKey(prev)]);
    await this.cmd(["SET", this.unameKey(n), address]);
    await this.cmd(["SET", this.addrNameKey(address), n]);
    return { ok: true, username: n };
  }
  async usernameToAddress(name: string) {
    return this.cmd<string | null>(["GET", this.unameKey(normUsername(name))]);
  }
  async addressToUsername(address: string) {
    return this.cmd<string | null>(["GET", this.addrNameKey(address)]);
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
export const markTxUsed = (txId: string) => getStore().markTxUsed(txId);
export const reserveEscrow = (amountUsd: number) =>
  getStore().reserveEscrow(amountUsd);
export const getReservedEscrow = () => getStore().getReservedEscrow();
export const claimUsername = (address: string, name: string) =>
  getStore().claimUsername(address, name);
export const usernameToAddress = (name: string) =>
  getStore().usernameToAddress(name);
export const addressToUsername = (address: string) =>
  getStore().addressToUsername(address);

/** True when a persistent backend is configured (for diagnostics). */
export const isPersistent = () => redisConfig() !== null;
