"use client";

import { useState } from "react";
import Link from "next/link";
import { useMagic } from "@/providers/MagicProvider";
import {
  useUniversalAccount,
  type SettleResult,
} from "@/providers/UniversalAccountProvider";
import { collectedUsd, REASON_META, type BeamLink } from "@/lib/links";
import { usd } from "@/lib/format";
import { arbiscanTokenTxns, universalxActivity } from "@/lib/chains";
import { GoogleGlyph } from "@/components/GoogleGlyph";
import { SettleAnimation } from "@/components/SettleAnimation";

export default function UserPayClient({
  username,
  recipient,
  campaigns = [],
}: {
  username: string;
  recipient: string | null;
  campaigns?: BeamLink[];
}) {
  const {
    magic,
    isLoggedIn,
    googleEnabled,
    loginWithEmailOTP,
    loginWithGoogle,
  } = useMagic();
  const { totalUsd, sendUsdcToArbitrum } = useUniversalAccount();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, setSettle] = useState<SettleResult | null>(null);

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

  const pay = () =>
    run(async () => {
      if (!recipient || !amount) return;
      const res = await sendUsdcToArbitrum(amount, recipient);
      setSettle(res);
    });

  if (!recipient)
    return (
      <main className="beam-shell items-center justify-center text-center">
        <div className="text-5xl">🫥</div>
        <h1 className="mt-2 text-2xl font-black">@{username}</h1>
        <p className="text-[var(--muted)]">
          No one owns this handle yet. Sign in to Beam and claim it.
        </p>
        <Link className="btn btn-primary mt-3" href="/">
          Open Beam
        </Link>
      </main>
    );

  if (settle)
    return (
      <main className="beam-shell items-center justify-center text-center">
        <div className="animate-pop text-6xl">✅</div>
        <h1 className="animate-pop text-3xl font-black">
          You paid {usd(amount)}
        </h1>
        <p className="text-[var(--muted)]">Sent to @{username} — on Arbitrum.</p>
        <SettleAnimation
          sourceChainIds={settle.sourceChainIds}
          gasless={settle.freeGasFee}
        />
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {settle.transactionId && (
            <a
              className="btn btn-ghost !px-3 !py-2"
              href={universalxActivity(settle.transactionId)}
              target="_blank"
              rel="noreferrer"
            >
              Activity
            </a>
          )}
          <a
            className="btn btn-ghost !px-3 !py-2"
            href={arbiscanTokenTxns(recipient)}
            target="_blank"
            rel="noreferrer"
          >
            View on Arbiscan
          </a>
        </div>
      </main>
    );

  return (
    <main className="beam-shell items-center justify-center">
      <div className="card w-full text-center">
        <div className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-[var(--accent)] text-xl font-bold">
          {username.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="mt-3 text-2xl font-black">Pay @{username}</h1>
        <p className="text-sm text-[var(--muted)]">Settles on Arbitrum</p>

        <div className="mt-5 flex items-center gap-2">
          <span className="text-3xl font-bold text-[var(--muted)]">$</span>
          <input
            className="input text-3xl font-bold"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>

        <div className="mt-5">
          {!isLoggedIn ? (
            <ClaimLogin
              busy={busy}
              disabled={!magic}
              googleEnabled={googleEnabled}
              onSignIn={(em) => run(() => loginWithEmailOTP(em))}
              onGoogle={() => run(loginWithGoogle)}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <button
                className="btn btn-primary"
                disabled={busy || !amount || Number(amount) <= 0}
                onClick={pay}
              >
                {busy ? "Settling on Arbitrum…" : `Pay ${usd(amount || 0)}`}
              </button>
              <p className="text-xs text-[var(--muted)]">
                Your balance: {usd(totalUsd)}
              </p>
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
      </div>

      {campaigns.length > 0 && (
        <section className="mt-5 flex w-full flex-col gap-2">
          <p className="px-1 text-sm text-[var(--muted)]">
            From @{username}
          </p>
          {campaigns.map((c) => (
            <StoreCard key={c.id} link={c} />
          ))}
        </section>
      )}

      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        No wallet needed. Powered by Particle Universal Accounts + Magic.
      </p>
    </main>
  );
}

/** A campaign/product card in a creator's storefront. */
function StoreCard({ link }: { link: BeamLink }) {
  const target = Number(link.amountUsd);
  const collected = collectedUsd(link);
  const isProduct = link.direction === "product";
  const isFund = link.direction === "fund";
  const pct = Math.min(100, target > 0 ? (collected / target) * 100 : 0);
  return (
    <Link
      href={`/claim/${link.id}`}
      className="card flex flex-col gap-2 !p-4 transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-semibold">
          {link.title || `${REASON_META[link.reason].emoji} ${usd(target)}`}
        </p>
        <span className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white">
          {isProduct ? `Buy ${usd(target)}` : isFund ? "Back" : "Pay"}
        </span>
      </div>
      {!isProduct && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--success)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="text-xs text-[var(--muted)]">
        {isProduct
          ? `${link.contributions?.length ?? 0} sold`
          : isFund
            ? `${usd(collected)} raised of ${usd(target)}`
            : `${usd(collected)} of ${usd(target)}`}
      </p>
    </Link>
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
            {busy ? "Connecting…" : "Continue with Google"}
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
        {busy ? "…" : "Continue with email"}
      </button>
    </div>
  );
}
