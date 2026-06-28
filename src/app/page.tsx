"use client";

import { useCallback, useEffect, useState } from "react";
import { useMagic } from "@/providers/MagicProvider";
import {
  useUniversalAccount,
  type SettleResult,
} from "@/providers/UniversalAccountProvider";
import {
  collectedUsd,
  isCampaign,
  REASON_META,
  type BeamLink,
  type Direction,
  type Reason,
} from "@/lib/links";
import { claimUrl, short, usd } from "@/lib/format";
import { chainName } from "@/lib/chains";
import { GoogleGlyph } from "@/components/GoogleGlyph";
import { Qr } from "@/components/Qr";
import { SettleAnimation } from "@/components/SettleAnimation";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";

const PRESETS: Reason[] = ["rent", "split", "gift", "tip"];

export default function Home() {
  const { isLoggedIn } = useMagic();
  return (
    <main className="beam-shell">{isLoggedIn ? <Dashboard /> : <Landing />}</main>
  );
}

/* ───────────────────────────── Landing (logged-out) ─────────────────────── */

function Landing() {
  const { magic, googleEnabled, loginWithGoogle, loginWithEmailOTP } =
    useMagic();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "google" | "email", fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const signIn = () => run("email", () => loginWithEmailOTP(email));

  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <div className="text-center">
        <div className="mb-3 text-5xl font-black tracking-tight">Beam</div>
        <p className="text-lg text-[var(--muted)]">
          Send money by link. Any chain.
          <br />
          They claim it with a tap.
        </p>
      </div>

      <div className="card flex flex-col gap-3">
        <label className="text-sm text-[var(--muted)]">
          Sign in to send or claim
        </label>
        {googleEnabled && (
          <>
            <button
              className="btn btn-ghost"
              disabled={busy !== null || !magic}
              onClick={() => run("google", loginWithGoogle)}
            >
              <GoogleGlyph />
              {busy === "google" ? "Connecting…" : "Continue with Google"}
            </button>
            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--border)]" />
              or
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
          </>
        )}
        <input
          className="input"
          type="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && email && signIn()}
        />
        <button
          className="btn btn-primary"
          disabled={!email || busy !== null || !magic}
          onClick={signIn}
        >
          {busy === "email" ? "Check your email…" : "Continue with email"}
        </button>
        {!process.env.NEXT_PUBLIC_MAGIC_API_KEY && (
          <p className="text-xs text-[var(--danger)]">
            Magic key missing — set NEXT_PUBLIC_MAGIC_API_KEY in .env.local
          </p>
        )}
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { e: "🔗", t: "Make a link" },
          { e: "📨", t: "Share it" },
          { e: "✨", t: "They tap to claim" },
        ].map((s) => (
          <div key={s.t} className="card !p-3">
            <div className="text-2xl">{s.e}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">{s.t}</div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        No wallet. No seed phrase. No chain picker.
        <br />
        Powered by Particle Universal Accounts · Magic · settles on Arbitrum
      </p>
    </div>
  );
}

/* ───────────────────────────── Dashboard (logged-in) ────────────────────── */

function Dashboard() {
  const { address, email, logout } = useMagic();
  const { totalUsd, primaryAssets, loading, refreshBalance, sendUsdcToArbitrum } =
    useUniversalAccount();
  const [links, setLinks] = useState<BeamLink[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settle, setSettle] = useState<SettleResult | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  };

  const loadLinks = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/links?sender=${address}`);
    if (res.ok) setLinks(await res.json());
  }, [address]);

  // Poll so a recipient's claim shows up on the sender's screen live.
  useEffect(() => {
    loadLinks();
    const t = setInterval(loadLinks, 4000);
    return () => clearInterval(t);
  }, [loadLinks]);

  const pay = async (link: BeamLink) => {
    if (!link.claimantAddress) return;
    setPayingId(link.id);
    setToast(null);
    setSettle(null);
    try {
      // Flip the recipient's view to "settling" the moment we start.
      await fetch(`/api/links/${link.id}/sending`, { method: "POST" });
      await loadLinks();
      const res = await sendUsdcToArbitrum(link.amountUsd, link.claimantAddress);
      await fetch(`/api/links/${link.id}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: res.transactionId }),
      });
      setToast(`Sent ${usd(link.amountUsd)} — settled on Arbitrum 🎉`);
      setSettle(res);
      await Promise.all([loadLinks(), refreshBalance()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
      // Roll the link back to "claiming" so it isn't stuck on "Sending…".
      if (link.claimantAddress) {
        await fetch(`/api/links/${link.id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claimantAddress: link.claimantAddress,
            claimantEmail: link.claimantEmail,
          }),
        });
        await loadLinks();
      }
    } finally {
      setPayingId(null);
    }
  };

  const initials = (email ?? "?").slice(0, 1).toUpperCase();

  return (
    <>
      <OnboardingOverlay active={loading} />
      <header className="flex items-center justify-between">
        <span className="text-2xl font-black tracking-tight">Beam</span>
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent)] text-sm font-bold">
            {initials}
          </div>
          <button
            className="text-xs text-[var(--muted)] underline"
            onClick={logout}
          >
            logout
          </button>
        </div>
      </header>

      <section className="card text-center">
        <p className="text-sm text-[var(--muted)]">Your balance</p>
        <p className="my-1 text-5xl font-black tracking-tight">
          {loading ? "…" : usd(totalUsd)}
        </p>
        <p className="text-xs text-[var(--muted)]">
          one balance · every chain · no chain picker
        </p>
        <ChainBreakdown assets={primaryAssets?.assets} />
        {!loading && totalUsd <= 0 && (
          <p className="mt-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
            Add a little USDC on any chain to start sending — Beam routes it
            automatically.
          </p>
        )}
        {address && (
          <button
            onClick={copyAddress}
            className="mx-auto mt-3 block rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)]"
            title="Deposit USDC to this address on any supported chain"
          >
            {copiedAddr ? "Address copied ✓" : `Deposit address: ${short(address)} · copy`}
          </button>
        )}
      </section>

      <LinkForm
        address={address!}
        senderName={email ?? undefined}
        onCreated={loadLinks}
      />

      <HandleCard address={address!} />

      {toast && (
        <div className="card animate-pop border-[var(--success)] text-center text-sm text-[var(--success)]">
          {toast}
          {settle && (
            <SettleAnimation
              sourceChainIds={settle.sourceChainIds}
              gasless={settle.freeGasFee}
            />
          )}
        </div>
      )}

      <Activity links={links} payingId={payingId} onPay={pay} />
    </>
  );
}

/* ───────────────────────────── @handle card ─────────────────────────────── */

function HandleCard({ address }: { address: string }) {
  const [name, setName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/username?address=${address}`)
      .then((r) => r.json())
      .then((d) => setName(d.name ?? null))
      .catch(() => {});
  }, [address]);

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, name: input }),
      });
      const d = await res.json();
      if (d.ok) setName(d.username);
      else setError(d.error ?? "Couldn't claim that handle");
    } finally {
      setBusy(false);
    }
  };

  const url =
    name && typeof window !== "undefined"
      ? `${window.location.origin}/u/${name}`
      : "";

  if (name) {
    return (
      <div className="card flex flex-col gap-3">
        <p className="text-sm text-[var(--muted)]">Your pay-me link</p>
        <p className="text-xl font-bold">@{name}</p>
        <Qr url={url} />
        <button
          className="btn btn-ghost"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied ✓" : `Copy ${url.replace(/^https?:\/\//, "")}`}
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">
        Claim your @handle — a permanent link anyone can pay you at
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold text-[var(--muted)]">@</span>
        <input
          className="input"
          placeholder="yourname"
          value={input}
          maxLength={20}
          onChange={(e) =>
            setInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
          onKeyDown={(e) => e.key === "Enter" && input && claim()}
        />
      </div>
      <button
        className="btn btn-primary"
        disabled={input.length < 3 || busy}
        onClick={claim}
      >
        {busy ? "Claiming…" : "Claim handle"}
      </button>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

/* ───────────────────── Link form (pay people / create campaign) ─────────── */

const PAY_MODES: Direction[] = ["send", "request", "split"];
const CREATE_MODES: Direction[] = ["fund", "product"];
const MODE_LABEL: Record<Direction, string> = {
  send: "Send",
  request: "Request",
  split: "Split",
  fund: "Fundraise",
  product: "Sell",
};

function LinkForm({
  address,
  senderName,
  onCreated,
}: {
  address: string;
  senderName?: string;
  onCreated: () => void;
}) {
  const [tier, setTier] = useState<"pay" | "create">("pay");
  const [mode, setMode] = useState<Direction>("send");
  const [amount, setAmount] = useState("");
  const [ways, setWays] = useState("");
  const [title, setTitle] = useState("");
  const [unlockUrl, setUnlockUrl] = useState("");
  const [reason, setReason] = useState<Reason>("none");
  const [note, setNote] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<BeamLink | null>(null);
  const [copied, setCopied] = useState(false);

  const isCreate = tier === "create";
  const isProduct = mode === "product";
  const isFund = mode === "fund";

  const switchTier = (t: "pay" | "create") => {
    setTier(t);
    setMode(t === "pay" ? "send" : "fund");
  };

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: mode,
          amountUsd: amount,
          reason,
          note: note || undefined,
          title: isCreate ? title || undefined : undefined,
          unlockUrl: isProduct ? unlockUrl || undefined : undefined,
          senderAddress: address,
          senderName,
          splitWays: mode === "split" ? Number(ways) || undefined : undefined,
        }),
      });
      if (res.ok) {
        const link: BeamLink = await res.json();
        setCreated(link);
        onCreated();
        if (recipientEmail) {
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: recipientEmail,
              url: claimUrl(link.id),
              amountUsd: link.amountUsd,
              fromName: senderName,
              direction: link.direction,
            }),
          }).catch(() => {});
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setAmount("");
    setWays("");
    setTitle("");
    setUnlockUrl("");
    setReason("none");
    setNote("");
    setRecipientEmail("");
    setCopied(false);
  };

  const share = async () => {
    if (!created) return;
    const url = claimUrl(created.id);
    const text =
      created.direction === "request"
        ? `Can you send me ${usd(created.amountUsd)}?`
        : created.direction === "split"
          ? `Chip in for ${usd(created.amountUsd)} on Beam`
          : created.direction === "fund"
            ? `Back "${created.title}" on Beam`
            : created.direction === "product"
              ? `Get "${created.title}" for ${usd(created.amountUsd)} on Beam`
              : `${usd(created.amountUsd)} for you`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Beam", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* user cancelled share */
    }
  };

  if (created) {
    const d = created.direction;
    const headline =
      d === "split"
        ? "Split ready — share it with the group"
        : d === "fund"
          ? "Campaign live — share it everywhere"
          : d === "product"
            ? "Product live — share it to sell"
            : d === "request"
              ? "Request ready — share it"
              : "Link ready — share it";
    return (
      <div className="card animate-pop flex flex-col gap-3">
        <p className="text-sm text-[var(--muted)]">{headline}</p>
        <p className="text-2xl font-bold">
          {created.title ? `${created.title} · ` : REASON_META[created.reason].emoji + " "}
          {usd(created.amountUsd)}
          {d === "product" ? (
            <span className="ml-1 text-sm font-normal text-[var(--muted)]">each</span>
          ) : d === "fund" ? (
            <span className="ml-1 text-sm font-normal text-[var(--muted)]">goal</span>
          ) : null}
        </p>
        <Qr url={claimUrl(created.id)} />
        <div className="truncate rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--accent-2)]">
          {claimUrl(created.id)}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={share}>
            {copied ? "Copied ✓" : "Share link"}
          </button>
          <button className="btn btn-ghost" onClick={reset}>
            New
          </button>
        </div>
      </div>
    );
  }

  const amountLabel = isFund ? "Goal" : isProduct ? "Price" : null;
  const subtitle = isFund
    ? "Crowdfund — anyone can chip in toward your goal"
    : isProduct
      ? "Sell a program — buyers pay, then unlock the content"
      : mode === "request"
        ? "Request money — they pay with a tap"
        : mode === "split"
          ? "Split a bill — everyone pays their share"
          : "Send money — they claim it with a tap";

  return (
    <div className="card flex flex-col gap-3">
      {/* Tier 1: Pay people / Create a campaign */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--surface-2)] p-1">
        {(
          [
            ["pay", "Pay people"],
            ["create", "Create a campaign"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => switchTier(t)}
            className="rounded-xl py-2 text-xs font-semibold transition-colors"
            style={{
              background: tier === t ? "var(--accent)" : "transparent",
              color: tier === t ? "white" : "var(--muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tier 2: mode within the chosen tier */}
      <div
        className="grid gap-1 rounded-2xl bg-[var(--surface-2)] p-1"
        style={{
          gridTemplateColumns: `repeat(${(isCreate ? CREATE_MODES : PAY_MODES).length}, 1fr)`,
        }}
      >
        {(isCreate ? CREATE_MODES : PAY_MODES).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="rounded-xl py-2 text-sm font-semibold transition-colors"
            style={{
              background: mode === m ? "var(--accent)" : "transparent",
              color: mode === m ? "white" : "var(--muted)",
            }}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      <p className="text-sm text-[var(--muted)]">{subtitle}</p>

      {isCreate && (
        <input
          className="input"
          placeholder={isProduct ? "Product name" : "Campaign title"}
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}

      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold text-[var(--muted)]">$</span>
        <input
          className="input text-3xl font-bold"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        {amountLabel && (
          <span className="shrink-0 text-sm text-[var(--muted)]">{amountLabel}</span>
        )}
      </div>

      {mode === "split" && (
        <div className="flex items-center gap-2">
          <input
            className="input"
            inputMode="numeric"
            placeholder="Split how many ways? (e.g. 4)"
            value={ways}
            onChange={(e) => setWays(e.target.value.replace(/[^0-9]/g, ""))}
          />
          {amount && Number(ways) >= 2 && (
            <span className="shrink-0 text-sm text-[var(--muted)]">
              {usd(Number(amount) / Number(ways))} each
            </span>
          )}
        </div>
      )}

      {isProduct && (
        <input
          className="input"
          placeholder="Unlock link revealed after purchase (course, file, invite…)"
          value={unlockUrl}
          maxLength={500}
          onChange={(e) => setUnlockUrl(e.target.value)}
        />
      )}

      {!isProduct && (
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((r) => (
            <button
              key={r}
              className="chip"
              data-active={reason === r}
              onClick={() => setReason(reason === r ? "none" : r)}
            >
              {REASON_META[r].emoji} {REASON_META[r].label}
            </button>
          ))}
        </div>
      )}

      <input
        className="input"
        placeholder={isCreate ? "Description (optional)" : "What's it for? (optional)"}
        value={note}
        maxLength={140}
        onChange={(e) => setNote(e.target.value)}
      />

      {(mode === "send" || mode === "request") && (
        <input
          className="input"
          type="email"
          inputMode="email"
          placeholder="Email it to them (optional)"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
        />
      )}

      <button
        className="btn btn-primary"
        disabled={
          !amount ||
          Number(amount) <= 0 ||
          busy ||
          (isCreate && !title)
        }
        onClick={create}
      >
        {busy
          ? "Creating…"
          : mode === "request"
            ? "Create request link"
            : mode === "split"
              ? "Create split link"
              : isFund
                ? "Launch campaign"
                : isProduct
                  ? "List product"
                  : "Create payment link"}
      </button>
    </div>
  );
}

/* ───────────────────────────── Activity feed ────────────────────────────── */

function Activity({
  links,
  payingId,
  onPay,
}: {
  links: BeamLink[];
  payingId: string | null;
  onPay: (link: BeamLink) => void;
}) {
  if (!links.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <p className="px-1 text-sm text-[var(--muted)]">Activity</p>
      {links.map((l) =>
        isCampaign(l.direction) ? (
          <CampaignRow key={l.id} link={l} />
        ) : (
          <div
            key={l.id}
            className="card flex items-center justify-between gap-3 !p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold">
                {REASON_META[l.reason].emoji} {usd(l.amountUsd)}
                <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                  {l.direction === "request" ? "request" : "sent"}
                </span>
              </p>
              <p className="truncate text-xs text-[var(--muted)]">
                {l.status === "pending" &&
                  (l.direction === "request"
                    ? "Waiting for payment"
                    : "Waiting to be claimed")}
                {l.status === "claiming" &&
                  `${l.claimantEmail ?? short(l.claimantAddress)} is ${
                    l.direction === "request" ? "paying" : "claiming"
                  }`}
                {l.status === "sending" && "Settling on Arbitrum…"}
                {l.status === "paid" &&
                  (l.direction === "request"
                    ? "Received on Arbitrum ✓"
                    : "Settled on Arbitrum ✓")}
              </p>
            </div>
            {/* Only "send" links need the creator to approve a payout. */}
            {l.direction === "send" && l.status === "claiming" && (
              <button
                className="btn btn-primary !px-4 !py-2"
                disabled={payingId === l.id}
                onClick={() => onPay(l)}
              >
                {payingId === l.id ? "Sending…" : `Send ${usd(l.amountUsd)}`}
              </button>
            )}
            {l.status === "pending" && (
              <Badge>{l.direction === "request" ? "Requested" : "Pending"}</Badge>
            )}
            {l.status === "sending" && <Badge>Sending…</Badge>}
            {l.status === "paid" && <Badge tone="success">Paid</Badge>}
          </div>
        ),
      )}
    </section>
  );
}

/** Activity row for a campaign (split / fund / product) — progress + counts. */
function CampaignRow({ link }: { link: BeamLink }) {
  const target = Number(link.amountUsd);
  const collected = collectedUsd(link);
  const n = link.contributions?.length ?? 0;
  const isProduct = link.direction === "product";
  const isFund = link.direction === "fund";
  const pct = Math.min(100, target > 0 ? (collected / target) * 100 : 0);
  const heading = link.title || `${REASON_META[link.reason].emoji} ${usd(target)}`;
  const tag = link.direction;

  return (
    <div className="card flex flex-col gap-2 !p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-semibold">
          {heading}
          <span className="ml-2 text-xs font-normal text-[var(--muted)]">{tag}</span>
        </p>
        {link.status === "paid" ? (
          <Badge tone="success">Funded</Badge>
        ) : (
          <Badge>
            {n} {isProduct ? (n === 1 ? "sale" : "sales") : n === 1 ? "payer" : "payers"}
          </Badge>
        )}
      </div>
      {!isProduct && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--success)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="text-xs text-[var(--muted)]">
        {isProduct
          ? `${usd(target)} each · ${usd(collected)} earned`
          : isFund
            ? `${usd(collected)} raised of ${usd(target)} goal`
            : `${usd(collected)} of ${usd(target)} collected`}
        {link.status === "paid" ? " · settled on Arbitrum ✓" : ""}
      </p>
    </div>
  );
}

/** Shows where the unified balance actually lives — the UA magic, made visible. */
function ChainBreakdown({
  assets,
}: {
  assets?: {
    chainAggregation: { token: { chainId: number }; amountInUSD: number }[];
  }[];
}) {
  if (!assets?.length) return null;
  const byChain = new Map<number, number>();
  for (const a of assets) {
    for (const c of a.chainAggregation) {
      if (c.amountInUSD > 0)
        byChain.set(
          c.token.chainId,
          (byChain.get(c.token.chainId) ?? 0) + c.amountInUSD,
        );
    }
  }
  const rows = [...byChain.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
      {rows.map(([id, amt]) => (
        <span
          key={id}
          className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--muted)]"
        >
          {chainName(id)} {usd(amt)}
        </span>
      ))}
    </div>
  );
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "success";
}) {
  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background:
          tone === "success"
            ? "color-mix(in srgb, var(--success) 20%, transparent)"
            : "var(--surface-2)",
        color: tone === "success" ? "var(--success)" : "var(--muted)",
      }}
    >
      {children}
    </span>
  );
}
