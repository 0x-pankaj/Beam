"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMagic } from "@/providers/MagicProvider";
import {
  useUniversalAccount,
  type SettleResult,
} from "@/providers/UniversalAccountProvider";
import { campaignRaisedUsd, REASON_META, type BeamLink } from "@/lib/links";
import { settleReport } from "@/lib/settle";
import { usd } from "@/lib/format";
import { arbiscanTokenTxns, arbiscanTx, universalxActivity } from "@/lib/chains";
import { offRampUrl } from "@/lib/ramp";
import { GoogleGlyph } from "@/components/GoogleGlyph";
import { SettleAnimation } from "@/components/SettleAnimation";

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
  const { totalUsd, sendUsdcToArbitrum } = useUniversalAccount();
  const [link, setLink] = useState<BeamLink | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [lastSettle, setLastSettle] = useState<SettleResult | null>(null);
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const announced = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/links/${id}`);
    if (res.status === 404) return setNotFound(true);
    if (res.ok) setLink(await res.json());
  }, [id]);

  // Poll so status changes (e.g. the sender approving, others chipping in) arrive live.
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  // SEND links: once the recipient logs in, announce the claim (record address).
  useEffect(() => {
    if (!isLoggedIn || !address || !link || announced.current) return;
    if (link.direction !== "send" || link.status === "paid") return;
    announced.current = true;
    fetch(`/api/links/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimantAddress: address, claimantEmail: email }),
    }).then(load);
  }, [isLoggedIn, address, email, link, id, load]);

  // PRODUCT links: if a logged-in buyer already purchased, re-reveal the content.
  useEffect(() => {
    if (!isLoggedIn || !address || !link || unlocked) return;
    if (link.direction !== "product") return;
    fetch(`/api/links/${id}/unlock?address=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.url && setUnlocked(d.url))
      .catch(() => {});
  }, [isLoggedIn, address, link, id, unlocked]);

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

  // REQUEST links: the opener pays the creator, settling on Arbitrum. With the
  // escrow configured the money goes into the link's own deposit address — the
  // server verifies it landed on-chain, then forwards it to the creator with a
  // real Arbitrum tx hash. Direct-to-creator only as the dev fallback.
  const payRequest = () =>
    run(async () => {
      if (!link || !address) return;
      await fetch(`/api/links/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimantAddress: address, claimantEmail: email }),
      });
      await fetch(`/api/links/${id}/sending`, { method: "POST" });
      await load();
      try {
        const res = await sendUsdcToArbitrum(
          link.amountUsd,
          link.escrowAddress ?? link.senderAddress,
        );
        setLastSettle(res);
        await settleReport(`/api/links/${id}/paid`, { txId: res.transactionId });
        await load();
      } catch (e) {
        await fetch(`/api/links/${id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimantAddress: address, claimantEmail: email }),
        });
        await load();
        throw e;
      }
    });

  // SPLIT / FUND: the opener contributes an amount; many can pay. Funds go to the
  // per-campaign escrow (verifiable total), or directly to the creator if escrow
  // isn't configured.
  const contribute = (amountUsd: string) =>
    run(async () => {
      if (!link || !address || !amountUsd || Number(amountUsd) <= 0) return;
      const res = await sendUsdcToArbitrum(amountUsd, link.escrowAddress ?? link.senderAddress);
      setLastSettle(res);
      await settleReport(`/api/links/${id}/contribute`, {
        address,
        email,
        amountUsd,
        txId: res.transactionId,
      });
      setShareInput("");
      await load();
    });

  // PRODUCT: the buyer pays the fixed price, then unlocks the content.
  const buyProduct = () =>
    run(async () => {
      if (!link || !address) return;
      const res = await sendUsdcToArbitrum(link.amountUsd, link.escrowAddress ?? link.senderAddress);
      setLastSettle(res);
      const data = await settleReport<{ unlocked?: string | null }>(
        `/api/links/${id}/contribute`,
        {
          address,
          email,
          amountUsd: link.amountUsd,
          txId: res.transactionId,
        },
      );
      if (data?.unlocked) setUnlocked(data.unlocked);
      await load();
    });

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
  const { direction } = link;
  const isRequest = direction === "request";
  const isSplit = direction === "split";
  const isFund = direction === "fund";
  const isProduct = direction === "product";
  const total = Number(link.amountUsd);
  const collected = campaignRaisedUsd(link);
  const remaining = Math.max(0, total - collected);
  const suggestedShare = link.splitWays
    ? Math.min(remaining || total / link.splitWays, total / link.splitWays)
    : remaining || total;
  // For a "send" link the recipient wants to see *their* incoming USDC; for
  // everything else the creator's address is the destination.
  const proofAddr =
    direction === "send" ? link.claimantAddress ?? address ?? link.senderAddress : link.senderAddress;
  const proofLinks = (
    <div className="mt-1 flex flex-wrap justify-center gap-2">
      {link.payoutTxId ? (
        <a
          className="btn btn-ghost !px-3 !py-2"
          href={arbiscanTx(link.payoutTxId)}
          target="_blank"
          rel="noreferrer"
        >
          Payout tx
        </a>
      ) : lastSettle?.transactionId ? (
        <a
          className="btn btn-ghost !px-3 !py-2"
          href={universalxActivity(lastSettle.transactionId)}
          target="_blank"
          rel="noreferrer"
        >
          Activity
        </a>
      ) : null}
      <a
        className="btn btn-ghost !px-3 !py-2"
        href={arbiscanTokenTxns(proofAddr)}
        target="_blank"
        rel="noreferrer"
      >
        View on Arbiscan
      </a>
    </div>
  );

  // ── Product purchased: show the unlocked content.
  if (isProduct && unlocked) {
    return (
      <main className="beam-shell items-center justify-center text-center">
        {lastSettle && <Confetti />}
        <div className="animate-pop text-6xl">🔓</div>
        <h1 className="animate-pop text-2xl font-black">
          {link.title || "Unlocked"}
        </h1>
        <p className="text-[var(--muted)]">You own this — here&apos;s your access:</p>
        <a
          className="btn btn-primary mt-1"
          href={unlocked}
          target="_blank"
          rel="noreferrer"
        >
          Open your content ↗
        </a>
        {lastSettle && <SettleAnimation sourceChainIds={lastSettle.sourceChainIds} gasless={lastSettle.freeGasFee} />}
        {proofLinks}
      </main>
    );
  }

  // ── Settled (send / request / split close out here; fund/product stay open).
  if (link.status === "paid") {
    return (
      <main className="beam-shell items-center justify-center text-center">
        <Confetti />
        <div className="animate-pop text-6xl">
          {isRequest ? "✅" : isSplit ? "🥳" : "🎉"}
        </div>
        <h1 className="animate-pop text-3xl font-black">
          {isRequest
            ? `You paid ${usd(link.amountUsd)}`
            : isSplit
              ? "Fully funded!"
              : `${usd(link.amountUsd)} received`}
        </h1>
        <p className="text-[var(--muted)]">
          {isRequest
            ? `Sent to ${from} — settled on Arbitrum.`
            : isSplit
              ? `${usd(total)} collected from ${link.contributions?.length ?? 0} people — settled to ${from} on Arbitrum.`
              : "Settled on Arbitrum — it's yours."}
        </p>
        <SettleAnimation
          sourceChainIds={lastSettle?.sourceChainIds ?? []}
          gasless={lastSettle?.freeGasFee}
        />
        {proofLinks}
        {!isRequest && !isSplit && address && (
          <a
            className="btn btn-primary mt-1"
            href={offRampUrl(address)}
            target="_blank"
            rel="noreferrer"
          >
            Cash out to your bank →
          </a>
        )}
      </main>
    );
  }

  const verb = isRequest
    ? "requesting"
    : isSplit
      ? "collecting"
      : isFund
        ? "raising"
        : isProduct
          ? "selling"
          : "sending you";
  const showProgress = isSplit || isFund;

  return (
    <main className="beam-shell items-center justify-center">
      <div className="card w-full text-center">
        <div className="text-5xl">{meta.emoji}</div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {from} is {verb}
        </p>
        {link.title && (isFund || isProduct) ? (
          <>
            <h1 className="my-1 text-3xl font-black tracking-tight">
              {link.title}
            </h1>
            <p className="text-lg font-semibold text-[var(--muted)]">
              {usd(link.amountUsd)}
              {isFund ? " goal" : ""}
              {isProduct ? " each" : ""}
            </p>
          </>
        ) : (
          <p className="my-1 text-5xl font-black tracking-tight">
            {usd(link.amountUsd)}
          </p>
        )}
        {link.note ? (
          <p className="mt-1 text-[var(--muted)]">&ldquo;{link.note}&rdquo;</p>
        ) : !link.title ? (
          <p className="text-[var(--muted)]">{meta.label}</p>
        ) : null}

        {showProgress && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--success)] transition-all"
                style={{
                  width: `${Math.min(100, total > 0 ? (collected / total) * 100 : 0)}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {usd(collected)} {isFund ? "raised of" : "of"} {usd(total)}
              {isFund ? " goal" : ""} · {link.contributions?.length ?? 0} paid
              {link.verifiedUsd != null ? " · ✓ verified on-chain" : ""}
            </p>
          </div>
        )}

        <div className="mt-6">
          {!isLoggedIn ? (
            <ClaimLogin
              busy={busy}
              disabled={!magic}
              googleEnabled={googleEnabled}
              cta={isProduct ? "Buy" : isRequest || isSplit || isFund ? "Pay" : "Claim"}
              onSignIn={signIn}
              onGoogle={signInGoogle}
            />
          ) : isProduct ? (
            <div className="flex flex-col gap-2">
              <button className="btn btn-primary" disabled={busy} onClick={buyProduct}>
                {busy ? "Settling on Arbitrum…" : `Buy for ${usd(link.amountUsd)}`}
              </button>
              <p className="text-xs text-[var(--muted)]">
                Your balance: {usd(totalUsd)} · unlocks instantly after payment
              </p>
            </div>
          ) : isSplit || isFund ? (
            <div className="flex flex-col gap-2">
              {lastSettle ? (
                <div className="animate-pop rounded-xl border border-[var(--success)] p-2 text-sm text-[var(--success)]">
                  Thanks — your {usd(shareInput || suggestedShare)} settled on Arbitrum 🎉
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-[var(--muted)]">$</span>
                <input
                  className="input text-xl font-bold"
                  inputMode="decimal"
                  placeholder={
                    isFund
                      ? remaining > 0
                        ? remaining.toFixed(2)
                        : "amount"
                      : suggestedShare.toFixed(2)
                  }
                  value={shareInput}
                  onChange={(e) =>
                    setShareInput(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  contribute(shareInput || (isFund ? "" : suggestedShare.toFixed(2)))
                }
              >
                {busy
                  ? "Settling on Arbitrum…"
                  : isFund
                    ? `Back ${shareInput ? usd(shareInput) : "this"}`
                    : `Pay ${usd(shareInput || suggestedShare)}`}
              </button>
              <p className="text-xs text-[var(--muted)]">
                Your balance: {usd(totalUsd)} · settles to {from} on Arbitrum
              </p>
            </div>
          ) : isRequest ? (
            <div className="flex flex-col gap-2">
              <button
                className="btn btn-primary"
                disabled={busy || link.status === "sending"}
                onClick={payRequest}
              >
                {busy || link.status === "sending"
                  ? "Settling on Arbitrum…"
                  : `Pay ${usd(link.amountUsd)}`}
              </button>
              <p className="text-xs text-[var(--muted)]">
                Your balance: {usd(totalUsd)} · settles to {from} on Arbitrum
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              <p className="text-sm text-[var(--muted)]">
                {link.status === "sending"
                  ? "Paying you now — settling on Arbitrum…"
                  : link.status === "funded"
                    ? "Funds are locked for you — claiming…"
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
  cta,
  onSignIn,
  onGoogle,
}: {
  busy: boolean;
  disabled: boolean;
  googleEnabled: boolean;
  cta: string;
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
            {busy ? "Connecting…" : `${cta} with Google`}
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
        {busy ? "…" : `${cta} with email`}
      </button>
    </div>
  );
}

/** Lightweight CSS confetti burst for the success moment. */
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
