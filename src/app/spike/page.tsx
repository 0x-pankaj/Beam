"use client";

/**
 * Beam SPIKE (browser) — proves the Magic <-> Particle UA <-> Arbitrum chain.
 *
 * This is the live, in-app proof of the full stack and the basis of the hero
 * flow. It exercises the real spine providers (not throwaway code):
 *
 *   Magic email login  ->  UA 7702 upgrade of the EOA  ->  unified USD balance
 *     ->  pre-delegate on Base  ->  send USDC that settles on ARBITRUM.
 *
 * Production swaps email-OTP for Google (Magic OAuth) — same signer, same UA.
 */
import { useState } from "react";
import { useMagic } from "@/providers/MagicProvider";
import { useUniversalAccount } from "@/providers/UniversalAccountProvider";
import { universalxActivity } from "@/lib/chains";

export default function SpikePage() {
  const { address, isLoggedIn, loginWithEmailOTP, logout } = useMagic();
  const {
    totalUsd,
    primaryAssets,
    isDelegated,
    loading,
    ensureDelegated,
    sendUsdcToArbitrum,
  } = useUniversalAccount();

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("0.5");
  const [receiver, setReceiver] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 p-6 font-mono text-sm">
      <header>
        <h1 className="text-xl font-bold">Beam · Spike</h1>
        <p className="text-zinc-500">Magic → UA 7702 → Arbitrum</p>
      </header>

      {!isLoggedIn ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 p-4">
          <label className="text-zinc-500">Sign in with email (Magic)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
          <button
            disabled={!email || busy === "login"}
            onClick={() =>
              run("login", async () => {
                await loginWithEmailOTP(email);
              })
            }
            className="rounded-lg bg-black px-3 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy === "login" ? "Sending code…" : "Log in"}
          </button>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-300 p-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">EOA (= Universal Account)</span>
              <button onClick={() => logout()} className="text-xs underline">
                logout
              </button>
            </div>
            <p className="break-all text-xs">{address}</p>
            <p className="mt-3 text-3xl font-bold">
              {loading ? "…" : `$${totalUsd.toFixed(2)}`}
            </p>
            <p className="text-zinc-500">unified balance · all chains</p>
            {primaryAssets?.assets
              ?.filter((a) => a.amountInUSD > 0)
              .map((a) => (
                <p key={a.tokenType} className="text-xs text-zinc-500">
                  {a.tokenType.toUpperCase()}: {a.amount} ($
                  {a.amountInUSD.toFixed(2)})
                </p>
              ))}
            <p className="mt-2 text-xs">
              Base delegation:{" "}
              <span className={isDelegated ? "text-green-600" : "text-red-600"}>
                {isDelegated ? "delegated" : "not delegated"}
              </span>
            </p>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-zinc-300 p-4">
            {!isDelegated && (
              <button
                disabled={busy !== null}
                onClick={() => run("delegate", ensureDelegated)}
                className="rounded-lg border border-black px-3 py-2 font-semibold disabled:opacity-50"
              >
                {busy === "delegate" ? "Delegating…" : "Delegate on Base (7702)"}
              </button>
            )}

            <label className="text-zinc-500">Send USDC → Arbitrum</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="amount"
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
            <input
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder={`receiver (default: ${address?.slice(0, 8)}…)`}
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
            <button
              disabled={busy !== null}
              onClick={() =>
                run("send", async () => {
                  const res = await sendUsdcToArbitrum(
                    amount,
                    receiver || address!,
                  );
                  setTxId(res.transactionId);
                })
              }
              className="rounded-lg bg-black px-3 py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy === "send" ? "Settling…" : "Send & settle on Arbitrum"}
            </button>
          </section>
        </>
      )}

      {txId && (
        <div className="rounded-xl border border-green-400 bg-green-50 p-4 text-green-800">
          🎉 Settled. tx: {txId}
          <br />
          <a
            href={universalxActivity(txId)}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            view activity
          </a>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-400 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}
    </main>
  );
}
