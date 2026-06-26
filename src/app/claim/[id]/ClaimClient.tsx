"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMagic } from "@/providers/MagicProvider";
import { REASON_META, type BeamLink } from "@/lib/links";
import { usd } from "@/lib/format";
import { universalxActivity } from "@/lib/chains";
import { GoogleGlyph } from "@/components/GoogleGlyph";

export default function ClaimClient({ id }: { id: string }) {
  const {
    magic,
    address,
    email,
    isLoggedIn,
    googleEnabled,
    loginWithEmailOTP,
    loginWithGoogle,
  } = useMagic();
  const [link, setLink] = useState<BeamLink | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const announced = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/links/${id}`);
    if (res.status === 404) return setNotFound(true);
    if (res.ok) setLink(await res.json());
  }, [id]);

  // Poll the link so "paid" arrives live once the sender pays.
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  // Once logged in, announce the claim (records my address for the sender).
  useEffect(() => {
    if (!isLoggedIn || !address || !link || announced.current) return;
    if (link.status === "paid") return;
    announced.current = true;
    fetch(`/api/links/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimantAddress: address, claimantEmail: email }),
    }).then(load);
  }, [isLoggedIn, address, email, link, id, load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const signIn = (emailInput: string) => run(() => loginWithEmailOTP(emailInput));
  const signInGoogle = () => run(loginWithGoogle);

  if (notFound)
    return (
      <main className="beam-shell items-center justify-center text-center">
        <p className="text-lg text-[var(--muted)]">
          This link doesn&apos;t exist.
        </p>
      </main>
    );

  if (!link)
    return (
      <main className="beam-shell items-center justify-center">
        <p className="text-[var(--muted)]">Loading…</p>
      </main>
    );

  const meta = REASON_META[link.reason];
  const from = link.senderName ?? "Someone";

  // ── Paid: the money landed.
  if (link.status === "paid") {
    return (
      <main className="beam-shell items-center justify-center text-center">
        <Confetti />
        <div className="animate-pop text-6xl">🎉</div>
        <h1 className="animate-pop text-3xl font-black">
          {usd(link.amountUsd)} received
        </h1>
        <p className="text-[var(--muted)]">
          Settled on Arbitrum — it&apos;s yours.
        </p>
        {link.txId && (
          <a
            className="btn btn-ghost mt-2"
            href={universalxActivity(link.txId)}
            target="_blank"
            rel="noreferrer"
          >
            View settlement
          </a>
        )}
      </main>
    );
  }

  return (
    <main className="beam-shell items-center justify-center">
      <div className="card w-full text-center">
        <div className="text-5xl">{meta.emoji}</div>
        <p className="mt-3 text-sm text-[var(--muted)]">{from} is sending you</p>
        <p className="my-1 text-5xl font-black tracking-tight">
          {usd(link.amountUsd)}
        </p>
        {link.note ? (
          <p className="text-[var(--muted)]">&ldquo;{link.note}&rdquo;</p>
        ) : (
          <p className="text-[var(--muted)]">{meta.label}</p>
        )}

        <div className="mt-6">
          {!isLoggedIn ? (
            <ClaimLogin
              busy={busy}
              disabled={!magic}
              googleEnabled={googleEnabled}
              onSignIn={signIn}
              onGoogle={signInGoogle}
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              <p className="text-sm text-[var(--muted)]">
                {link.status === "sending"
                  ? "On its way — settling on Arbitrum…"
                  : `Waiting for ${from} to approve…`}
              </p>
              <p className="text-xs text-[var(--muted)]">
                You&apos;re all set — keep this page open.
              </p>
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
      </div>
      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        No wallet needed. Powered by Particle Universal Accounts + Magic.
      </p>
    </main>
  );
}

function ClaimLogin({
  busy,
  disabled,
  googleEnabled,
  onSignIn,
  onGoogle,
}: {
  busy: boolean;
  disabled: boolean;
  googleEnabled: boolean;
  onSignIn: (email: string) => void;
  onGoogle: () => void;
}) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {googleEnabled && (
        <>
          <button
            className="btn btn-primary"
            disabled={busy || disabled}
            onClick={onGoogle}
          >
            <GoogleGlyph />
            {busy ? "Connecting…" : "Claim with Google"}
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
        onKeyDown={(e) => e.key === "Enter" && email && onSignIn(email)}
      />
      <button
        className={googleEnabled ? "btn btn-ghost" : "btn btn-primary"}
        disabled={!email || busy || disabled}
        onClick={() => onSignIn(email)}
      >
        {busy ? "…" : "Claim with email"}
      </button>
    </div>
  );
}

/** Lightweight CSS confetti burst for the claim success moment. */
function Confetti() {
  const colors = ["#7c5cff", "#5ad1ff", "#34d399", "#fbbf24", "#fb7185"];
  const pieces = Array.from({ length: 28 });
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 7) * 0.12;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-10px",
              left: `${left}%`,
              width: "8px",
              height: "12px",
              background: color,
              borderRadius: "2px",
              animation: `confetti-fall 1.8s ${delay}s ease-in forwards`,
            }}
          />
        );
      })}
    </div>
  );
}
