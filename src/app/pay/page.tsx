"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMagic } from "@/providers/MagicProvider";
import {
  useUniversalAccount,
  type SettleResult,
} from "@/providers/UniversalAccountProvider";
import { usd, short } from "@/lib/format";
import { arbiscanTokenTxns, universalxActivity } from "@/lib/chains";
import { parseScan, resolveRecipient } from "@/lib/pay-target";
import { GoogleGlyph } from "@/components/GoogleGlyph";
import { SettleAnimation } from "@/components/SettleAnimation";
import { QrScan } from "@/components/QrScan";

export default function PayPage() {
  const {
    magic,
    isLoggedIn,
    googleEnabled,
    loginWithEmailOTP,
    loginWithGoogle,
  } = useMagic();
  const { totalUsd, sendUsdcToArbitrum } = useUniversalAccount();
  const router = useRouter();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settle, setSettle] = useState<{ res: SettleResult; to: string; label: string } | null>(null);

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

  const onScan = (text: string) => {
    setScanning(false);
    const r = parseScan(text, window.location.origin);
    if (r.kind === "route") router.push(r.path); // universal: open Beam links
    else if (r.kind === "address") {
      setRecipient(r.address);
      if (r.amount) setAmount(r.amount);
    } else if (r.kind === "ens") setRecipient(r.name);
    else setError("Unrecognized QR code");
  };

  const pay = () =>
    run(async () => {
      const { address, label } = await resolveRecipient(recipient);
      const res = await sendUsdcToArbitrum(amount, address);
      setSettle({ res, to: address, label });
    });

  // ── Success.
  if (settle)
    return (
      <main className="beam-shell items-center justify-center text-center">
        <div className="animate-pop text-6xl">✅</div>
        <h1 className="animate-pop text-3xl font-black">Sent {usd(amount)}</h1>
        <p className="text-[var(--muted)]">
          To {settle.label.endsWith(".eth") ? settle.label : short(settle.to)} —
          settled on Arbitrum.
        </p>
        <SettleAnimation
          sourceChainIds={settle.res.sourceChainIds}
          gasless={settle.res.freeGasFee}
        />
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {settle.res.transactionId && (
            <a
              className="btn btn-ghost !px-3 !py-2"
              href={universalxActivity(settle.res.transactionId)}
              target="_blank"
              rel="noreferrer"
            >
              Activity
            </a>
          )}
          <a
            className="btn btn-ghost !px-3 !py-2"
            href={arbiscanTokenTxns(settle.to)}
            target="_blank"
            rel="noreferrer"
          >
            View on Arbiscan
          </a>
        </div>
        <Link className="btn btn-primary mt-2" href="/">
          Done
        </Link>
      </main>
    );

  return (
    <main className="beam-shell">
      {scanning && (
        <QrScan onResult={onScan} onClose={() => setScanning(false)} />
      )}

      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-[var(--muted)]">
          ← Back
        </Link>
        <span className="text-lg font-black tracking-tight">Pay anyone</span>
        <span className="w-10" />
      </header>

      <div className="card flex flex-col gap-3">
        <p className="text-sm text-[var(--muted)]">
          Pay any wallet — settles as USDC on Arbitrum
        </p>

        <div className="flex gap-2">
          <input
            className="input"
            placeholder="0x… address or name.eth"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <button
            className="btn btn-ghost shrink-0 !px-3"
            onClick={() => setScanning(true)}
            title="Scan a QR"
          >
            ⛶ Scan
          </button>
        </div>

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

        {!isLoggedIn ? (
          <Login
            busy={busy}
            disabled={!magic}
            googleEnabled={googleEnabled}
            onSignIn={(em) => run(() => loginWithEmailOTP(em))}
            onGoogle={() => run(loginWithGoogle)}
          />
        ) : (
          <>
            <button
              className="btn btn-primary"
              disabled={busy || !recipient || !amount || Number(amount) <= 0}
              onClick={pay}
            >
              {busy ? "Settling on Arbitrum…" : `Pay ${usd(amount || 0)}`}
            </button>
            <p className="text-xs text-[var(--muted)]">
              Your balance: {usd(totalUsd)}
            </p>
          </>
        )}
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>

      <p className="mt-2 text-center text-xs text-[var(--muted)]">
        Pay a MetaMask address, an ENS name, or scan their QR — they receive USDC
        on Arbitrum.
      </p>
    </main>
  );
}

function Login({
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
            {busy ? "Connecting…" : "Sign in with Google to pay"}
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
        {busy ? "…" : "Sign in with email"}
      </button>
    </div>
  );
}
