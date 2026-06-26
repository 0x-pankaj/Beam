"use client";

import { useCallback, useEffect, useState } from "react";
import { useMagic } from "@/providers/MagicProvider";
import { useUniversalAccount } from "@/providers/UniversalAccountProvider";
import { REASON_META, type BeamLink, type Reason } from "@/lib/links";
import { claimUrl, short, usd } from "@/lib/format";

const PRESETS: Reason[] = ["rent", "split", "gift", "tip"];

export default function Home() {
  const { isLoggedIn } = useMagic();
  return (
    <main className="beam-shell">{isLoggedIn ? <Dashboard /> : <Landing />}</main>
  );
}

/* ───────────────────────────── Landing (logged-out) ─────────────────────── */

function Landing() {
  const { magic, loginWithEmailOTP } = useMagic();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginWithEmailOTP(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

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
          disabled={!email || busy || !magic}
          onClick={signIn}
        >
          {busy ? "Check your email…" : "Continue"}
        </button>
        {!magic && (
          <p className="text-xs text-[var(--danger)]">
            Magic key missing — set NEXT_PUBLIC_MAGIC_API_KEY in .env.local
          </p>
        )}
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        Chain-abstracted by Particle Universal Accounts · Magic · settles on
        Arbitrum
      </p>
    </div>
  );
}

/* ───────────────────────────── Dashboard (logged-in) ────────────────────── */

function Dashboard() {
  const { address, email, logout } = useMagic();
  const { totalUsd, loading, refreshBalance, sendUsdcToArbitrum } =
    useUniversalAccount();
  const [links, setLinks] = useState<BeamLink[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    try {
      const res = await sendUsdcToArbitrum(link.amountUsd, link.claimantAddress);
      await fetch(`/api/links/${link.id}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txId: res.transactionId }),
      });
      setToast(`Sent ${usd(link.amountUsd)} — settled on Arbitrum 🎉`);
      await Promise.all([loadLinks(), refreshBalance()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setPayingId(null);
    }
  };

  const initials = (email ?? "?").slice(0, 1).toUpperCase();

  return (
    <>
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
      </section>

      <RequestForm
        address={address!}
        senderName={email ?? undefined}
        onCreated={loadLinks}
      />

      {toast && (
        <div className="card animate-pop border-[var(--success)] text-center text-sm text-[var(--success)]">
          {toast}
        </div>
      )}

      <Activity links={links} payingId={payingId} onPay={pay} />
    </>
  );
}

/* ───────────────────────────── Request form ─────────────────────────────── */

function RequestForm({
  address,
  senderName,
  onCreated,
}: {
  address: string;
  senderName?: string;
  onCreated: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<Reason>("none");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<BeamLink | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amount,
          reason,
          note: note || undefined,
          senderAddress: address,
          senderName,
        }),
      });
      if (res.ok) {
        setCreated(await res.json());
        onCreated();
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setAmount("");
    setReason("none");
    setNote("");
    setCopied(false);
  };

  const share = async () => {
    if (!created) return;
    const url = claimUrl(created.id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Beam",
          text: `${usd(created.amountUsd)} for you`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* user cancelled share */
    }
  };

  if (created) {
    return (
      <div className="card animate-pop flex flex-col gap-3">
        <p className="text-sm text-[var(--muted)]">Link ready — share it</p>
        <p className="text-2xl font-bold">
          {REASON_META[created.reason].emoji} {usd(created.amountUsd)}
        </p>
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

  return (
    <div className="card flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">Request money</p>
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold text-[var(--muted)]">$</span>
        <input
          className="input text-3xl font-bold"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </div>
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
      <input
        className="input"
        placeholder="What's it for? (optional)"
        value={note}
        maxLength={140}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        className="btn btn-primary"
        disabled={!amount || Number(amount) <= 0 || busy}
        onClick={create}
      >
        {busy ? "Creating…" : "Create link"}
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
      {links.map((l) => (
        <div
          key={l.id}
          className="card flex items-center justify-between gap-3 !p-4"
        >
          <div className="min-w-0">
            <p className="font-semibold">
              {REASON_META[l.reason].emoji} {usd(l.amountUsd)}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {l.status === "pending" && "Waiting to be claimed"}
              {l.status === "claiming" &&
                `${l.claimantEmail ?? short(l.claimantAddress)} is claiming`}
              {l.status === "paid" && "Settled on Arbitrum ✓"}
            </p>
          </div>
          {l.status === "claiming" && (
            <button
              className="btn btn-primary !px-4 !py-2"
              disabled={payingId === l.id}
              onClick={() => onPay(l)}
            >
              {payingId === l.id ? "Sending…" : `Send ${usd(l.amountUsd)}`}
            </button>
          )}
          {l.status === "pending" && <Badge>Pending</Badge>}
          {l.status === "paid" && <Badge tone="success">Paid</Badge>}
        </div>
      ))}
    </section>
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
