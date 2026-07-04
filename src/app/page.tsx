"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMagic } from "@/providers/MagicProvider";
import {
  useUniversalAccount,
  type SettleResult,
} from "@/providers/UniversalAccountProvider";
import {
  campaignRaisedUsd,
  daysWaiting,
  isCampaign,
  isExpired,
  REASON_META,
  type BeamLink,
  type Direction,
  type Reason,
} from "@/lib/links";
import { claimUrl, short, usd } from "@/lib/format";
import { linkActionMessage } from "@/lib/auth";
import { settleReport } from "@/lib/settle";
import { chainName, SETTLEMENT_CHAIN_ID } from "@/lib/chains";
import { onRampUrl, offRampUrl } from "@/lib/ramp";
import { ReceiveModal } from "@/components/ReceiveModal";
import { GoogleGlyph } from "@/components/GoogleGlyph";
import { Qr } from "@/components/Qr";
import { SettleAnimation } from "@/components/SettleAnimation";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import {
  ActivityIcon,
  BeamBolt,
  CheckIcon,
  CopyIcon,
  GiftIcon,
  HomeIcon,
  LogoutIcon,
  RequestIcon,
  ScanIcon,
  SendIcon,
  SplitIcon,
  StoreIcon,
  TipIcon,
  UserIcon,
} from "@/components/icons";

const PRESETS: Reason[] = ["rent", "split", "gift", "tip"];

const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function Home() {
  const { isLoggedIn, restoring } = useMagic();
  if (isLoggedIn) return <Dashboard />;
  // Hold a neutral splash while the previous session restores, so a refresh
  // never flashes the logged-out landing page at a logged-in user.
  if (restoring)
    return (
      <main className="beam-shell items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </main>
    );
  return <Landing />;
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

  const points = [
    "No wallet or seed phrase to claim",
    "Pay from any chain you hold",
    "Settles instantly as USDC on Arbitrum",
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(20px,5vw,48px)",
        background:
          "radial-gradient(1000px 560px at 50% -8%, var(--at) 0%, transparent 58%), var(--paper)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1000,
          display: "flex",
          flexWrap: "wrap",
          gap: "clamp(28px,5vw,64px)",
          alignItems: "center",
        }}
      >
        {/* Pitch */}
        <div style={{ flex: "1 1 360px", minWidth: 300 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 26,
            }}
          >
            <BeamMark size={38} radius={11} />
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
              Beam
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(34px,5.4vw,52px)",
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: "-.035em",
              margin: "0 0 18px",
            }}
          >
            Send money by link.
            <br />
            <span style={{ color: "var(--ap)" }}>Any chain.</span>
          </h1>
          <p
            style={{
              fontSize: "clamp(16px,2.2vw,19px)",
              color: "#5e6b62",
              margin: "0 0 28px",
              maxWidth: 440,
            }}
          >
            They claim it with a tap — no wallet, no seed phrase, no chain
            picker. Everything settles as USDC on Arbitrum.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 440 }}>
            {points.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: "var(--at)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--ap)",
                  }}
                >
                  <CheckIcon size={15} />
                </span>
                <span style={{ fontSize: 15, color: "#3a453e", fontWeight: 500 }}>
                  {p}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Auth card */}
        <div style={{ flex: "1 1 340px", minWidth: 300, maxWidth: 430 }}>
          <div
            className="animate-pop"
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 24,
              padding: 28,
              boxShadow:
                "0 1px 2px rgba(16,21,18,.04),0 24px 50px -28px rgba(16,21,18,.28)",
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#79857c",
                margin: "0 0 4px",
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Get started
            </p>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-.02em",
                margin: "0 0 20px",
              }}
            >
              Sign in to send or claim
            </h2>

            {googleEnabled && (
              <>
                <button
                  className="btn btn-ghost"
                  style={{ width: "100%", marginBottom: 4 }}
                  disabled={busy !== null || !magic}
                  onClick={() => run("google", loginWithGoogle)}
                >
                  <GoogleGlyph />
                  {busy === "google" ? "Connecting…" : "Continue with Google"}
                </button>
                <Divider>OR</Divider>
              </>
            )}

            <input
              className="input"
              style={{ marginBottom: 12 }}
              type="email"
              inputMode="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && signIn()}
            />
            <button
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={!email || busy !== null || !magic}
              onClick={signIn}
            >
              {busy === "email" ? "Check your email…" : "Continue with email"}
            </button>

            {!process.env.NEXT_PUBLIC_MAGIC_API_KEY && (
              <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 12 }}>
                Magic key missing — set NEXT_PUBLIC_MAGIC_API_KEY in .env.local
              </p>
            )}
            {error && (
              <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 12 }}>
                {error}
              </p>
            )}

            <p
              style={{
                fontSize: 12,
                color: "#9aa69d",
                textAlign: "center",
                margin: "18px 0 0",
                lineHeight: 1.5,
              }}
            >
              Powered by Particle Universal Accounts · Magic
              <br />
              Settles on Arbitrum
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Dashboard (logged-in) ────────────────────── */

function Dashboard() {
  const { address, email, logout, signMessage } = useMagic();
  const {
    totalUsd,
    primaryAssets,
    loading,
    refreshBalance,
    sendUsdcToArbitrum,
    offArbitrumUsdc,
    consolidateToArbitrum,
  } = useUniversalAccount();
  const [links, setLinks] = useState<BeamLink[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settle, setSettle] = useState<SettleResult | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [mode, setMode] = useState<Direction>("send");

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const pay = async (link: BeamLink) => {
    if (!link.claimantAddress) return;
    setPayingId(link.id);
    setToast(null);
    setSettle(null);
    try {
      const relayer = await fetch("/api/relayer")
        .then((r) => r.json())
        .catch(() => null);
      if (link.direction === "send" && relayer?.configured && relayer.address) {
        // Escrow path: deposit into the relayer, let the server verify it
        // landed on-chain (fund), then the claim route pays the recipient out
        // of escrow with a real Arbitrum tx hash. Nothing is taken on faith.
        const res = await sendUsdcToArbitrum(link.amountUsd, relayer.address);
        setSettle(res);
        await settleReport(`/api/links/${link.id}/fund`, {
          txId: res.transactionId,
        });
        await settleReport(`/api/links/${link.id}/claim`, {
          claimantAddress: link.claimantAddress,
          claimantEmail: link.claimantEmail,
        });
      } else {
        // Dev fallback (no relayer): pay the claimant directly and report it.
        // Flip the recipient's view to "settling" the moment we start.
        await fetch(`/api/links/${link.id}/sending`, { method: "POST" });
        await loadLinks();
        const res = await sendUsdcToArbitrum(link.amountUsd, link.claimantAddress);
        await settleReport(`/api/links/${link.id}/paid`, {
          txId: res.transactionId,
        });
        setSettle(res);
      }
      setToast(`Sent ${usd(link.amountUsd)} — settled on Arbitrum`);
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

  // Sweep inbound USDC that landed on other chains onto Arbitrum (one tap).
  const consolidate = async () => {
    setSweeping(true);
    setToast(null);
    setSettle(null);
    try {
      const moved = offArbitrumUsdc;
      const res = await consolidateToArbitrum();
      setToast(`Moved ${usd(moved)} to Arbitrum`);
      setSettle(res);
      await refreshBalance();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setSweeping(false);
    }
  };

  // Which chains the off-Arbitrum USDC is sitting on (for the banner copy).
  const offChains = useMemo(() => {
    const ids = new Set<number>();
    for (const a of primaryAssets?.assets ?? []) {
      if (String(a.tokenType).toLowerCase() !== "usdc") continue;
      for (const c of a.chainAggregation ?? [])
        if (c.token.chainId !== SETTLEMENT_CHAIN_ID && c.amountInUSD > 0)
          ids.add(c.token.chainId);
    }
    return [...ids];
  }, [primaryAssets]);

  // Auto-fire the sweep once per session when a meaningful amount lands off-chain.
  // Skips dust (<$1) so UA fees never eat the whole deposit; the banner remains
  // for manual control of smaller amounts or a retry.
  const autoSwept = useRef(false);
  useEffect(() => {
    if (autoSwept.current || sweeping || offArbitrumUsdc < 1) return;
    autoSwept.current = true;
    consolidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offArbitrumUsdc]);

  // Collect a campaign's verified escrow balance to the creator's account.
  // Creator-only: we prove it by signing the request with the Magic EOA.
  const collect = async (link: BeamLink) => {
    setPayingId(link.id);
    setToast(null);
    try {
      const ts = Date.now();
      const signature = await signMessage(
        linkActionMessage("collect", link.id, link.senderAddress, ts),
      );
      const res = await fetch(`/api/links/${link.id}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ts, signature }),
      });
      const d = await res.json().catch(() => ({}));
      setToast(res.ok ? `Collected ${usd(d.amountUsd ?? 0)} — settled on Arbitrum` : d.error || "Collect failed");
      await Promise.all([loadLinks(), refreshBalance()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setPayingId(null);
    }
  };

  // Reclaim an unclaimed, funded escrow link — money returns to the sender.
  // Sender-only: signed so nobody else can cancel a payment they didn't make.
  const refund = async (link: BeamLink) => {
    setPayingId(link.id);
    setToast(null);
    try {
      const ts = Date.now();
      const signature = await signMessage(
        linkActionMessage("refund", link.id, link.senderAddress, ts),
      );
      const res = await fetch(`/api/links/${link.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ts, signature }),
      });
      if (res.ok) setToast(`Refunded ${usd(link.amountUsd)} to you`);
      else {
        const e = await res.json().catch(() => ({}));
        setToast(e.error || "Refund failed");
      }
      await Promise.all([loadLinks(), refreshBalance()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setPayingId(null);
    }
  };

  // Unclaimed send links past the expiry window — money you can pull back.
  const reclaimable = links.filter((l) => isExpired(l));
  const reclaimableUsd = reclaimable.reduce((s, l) => s + Number(l.amountUsd), 0);

  const initials = (email ?? "?").slice(0, 1).toUpperCase();
  const balanceStr = loading ? "…" : usd(totalUsd);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <OnboardingOverlay active={loading} />

      {/* DESKTOP SIDEBAR */}
      <aside
        className="show-desktop"
        style={{
          width: 268,
          flexShrink: 0,
          borderRight: "1px solid var(--line)",
          background: "#fff",
          flexDirection: "column",
          padding: "22px 16px",
          gap: 6,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 16px" }}>
          <BeamMark size={34} radius={10} />
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }}>Beam</span>
        </div>

        <div
          style={{
            background: "linear-gradient(150deg,var(--ab),var(--ap))",
            borderRadius: 16,
            padding: 16,
            marginBottom: 10,
            color: "#fff",
            boxShadow: "0 14px 28px -16px var(--ashd)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Balance</p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {balanceStr}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.8 }}>
            one balance · every chain
          </p>
        </div>

        <NavButton icon={<HomeIcon />} label="Home" active onClick={() => scrollToId("top")} />
        <NavLink href="/pay" icon={<ScanIcon />} label="Pay anyone" />
        <NavButton icon={<ActivityIcon />} label="Activity" onClick={() => scrollToId("activity")} />
        <NavButton icon={<UserIcon />} label="Your @handle" onClick={() => scrollToId("handle")} />

        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            borderRadius: 14,
            background: "var(--field)",
          }}
        >
          <Avatar initials={initials} size={34} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              {email ? email.split("@")[0] : "You"}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "#9aa69d",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {short(address)}
            </p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9aa69d",
              display: "flex",
              padding: 4,
            }}
          >
            <LogoutIcon size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <div id="top" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* MOBILE HEADER */}
        <header
          className="show-mobile"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 18px",
            background: "rgba(243,245,242,.88)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <BeamMark size={30} radius={9} />
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>Beam</span>
          </div>
          <button
            onClick={() => setAcctOpen(true)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
            title="Account"
            aria-label="Account menu"
          >
            <Avatar initials={initials} size={34} />
          </button>
        </header>

        {/* MOBILE ACCOUNT SHEET — who's logged in + log out */}
        {acctOpen && (
          <div
            className="show-mobile"
            onClick={() => setAcctOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 70,
              background: "rgba(16,21,18,.45)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 62,
                right: 14,
                left: 14,
                background: "#fff",
                borderRadius: 18,
                padding: 16,
                boxShadow: "0 24px 48px -18px rgba(16,21,18,.4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <Avatar initials={initials} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#9aa69d" }}>
                    Signed in as
                  </p>
                  <p
                    style={{
                      margin: "1px 0 0",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#10211a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {email ?? short(address)}
                  </p>
                  {email && address && (
                    <p
                      style={{
                        margin: "1px 0 0",
                        fontSize: 11,
                        color: "#9aa69d",
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      {short(address)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setAcctOpen(false);
                  logout();
                }}
                style={{
                  marginTop: 14,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "var(--field)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#9a3a3a",
                  cursor: "pointer",
                }}
              >
                <LogoutIcon size={16} />
                Log out
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 1180,
            // Left-align against the sidebar (extra room spills right) so wide
            // desktops don't leave a big gap between the nav and the content.
            // Below the max width the content just fills the column.
            margin: "0 auto 0 0",
            padding: "clamp(16px,3.5vw,36px)",
            paddingBottom: 96,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
            {/* LEFT COLUMN */}
            <div
              style={{
                flex: "1.3 1 380px",
                minWidth: 300,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <BalanceHero
                balanceStr={balanceStr}
                assets={primaryAssets?.assets}
                address={address}
                copied={copiedAddr}
                onCopy={copyAddress}
              />

              {offArbitrumUsdc >= 0.5 && (
                <div
                  className="animate-pop"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#fff7ec",
                    border: "1px solid #f3dcae",
                    borderRadius: 16,
                    padding: "13px 15px",
                  }}
                >
                  <span style={{ fontSize: 22 }}>💸</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#7a5a18" }}>
                      {usd(offArbitrumUsdc)} arrived on{" "}
                      {offChains.length ? offChains.map(chainName).join(", ") : "another chain"}
                    </p>
                    <p style={{ margin: "1px 0 0", fontSize: 12, color: "#9a7e3f" }}>
                      {sweeping
                        ? "Routing to Arbitrum via Particle…"
                        : "Auto-routing to Arbitrum — or move it now."}
                    </p>
                  </div>
                  <button
                    onClick={consolidate}
                    disabled={sweeping}
                    style={{
                      flexShrink: 0,
                      background: "var(--ac)",
                      border: "none",
                      borderRadius: 11,
                      padding: "9px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      cursor: sweeping ? "default" : "pointer",
                      opacity: sweeping ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sweeping ? "Moving…" : "Move to Arbitrum"}
                  </button>
                </div>
              )}

              {reclaimable.length > 0 && (
                <button
                  onClick={() => scrollToId("activity")}
                  className="animate-pop"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                    width: "100%",
                    background: "#fdf0f0",
                    border: "1px solid #f1cccc",
                    borderRadius: 16,
                    padding: "13px 15px",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 22 }}>⏰</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#9a3a3a" }}>
                      {usd(reclaimableUsd)} in {reclaimable.length} unclaimed link
                      {reclaimable.length > 1 ? "s" : ""}
                    </p>
                    <p style={{ margin: "1px 0 0", fontSize: 12, color: "#bf6a6a" }}>
                      Nobody claimed these — reclaim your money below.
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#9a3a3a", whiteSpace: "nowrap" }}>
                    View →
                  </span>
                </button>
              )}

              <QuickActions
                onMode={(m) => {
                  setMode(m);
                  scrollToId("create");
                }}
              />

              <LinkForm
                address={address!}
                senderName={email ?? undefined}
                senderEmail={email ?? undefined}
                onCreated={loadLinks}
                mode={mode}
                setMode={setMode}
              />

              {settle && (
                <div className="card animate-pop" style={{ textAlign: "center" }}>
                  <SettleAnimation
                    sourceChainIds={settle.sourceChainIds}
                    gasless={settle.freeGasFee}
                  />
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div
              style={{
                flex: "1 1 320px",
                minWidth: 300,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <Activity
                links={links}
                payingId={payingId}
                onPay={pay}
                onRefund={refund}
                onCollect={collect}
              />
              <HandleCard address={address!} />
            </div>
          </div>
        </div>

        {/* MOBILE BOTTOM NAV */}
        <nav
          className="show-mobile"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(14px)",
            borderTop: "1px solid var(--line)",
            alignItems: "flex-end",
            justifyContent: "space-around",
            padding: "9px 6px 14px",
          }}
        >
          <TabButton icon={<HomeIcon size={22} />} label="Home" active onClick={() => scrollToId("top")} />
          <TabLink href="/pay" icon={<ScanIcon size={22} />} label="Pay" />
          <button
            onClick={() => scrollToId("create")}
            style={{ background: "none", border: "none", cursor: "pointer", flex: 1, display: "flex", justifyContent: "center" }}
            aria-label="Create"
          >
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: "var(--ac)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 20px -8px var(--ash)",
                marginTop: -22,
                color: "#fff",
              }}
            >
              <SendIcon size={22} />
            </span>
          </button>
          <TabButton icon={<ActivityIcon size={22} />} label="Activity" onClick={() => scrollToId("activity")} />
          <TabButton icon={<UserIcon size={22} />} label="You" onClick={() => scrollToId("handle")} />
        </nav>
      </div>

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 88,
            transform: "translateX(-50%)",
            zIndex: 90,
            background: "var(--ink)",
            color: "#fff",
            borderRadius: 14,
            padding: "13px 20px",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 16px 36px -12px rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "beamUp .3s ease both",
            maxWidth: "90vw",
          }}
        >
          <span style={{ color: "var(--an)", display: "flex" }}>
            <CheckIcon size={18} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Balance hero ─────────────────────────────── */

function BalanceHero({
  balanceStr,
  assets,
  address,
  copied,
  onCopy,
}: {
  balanceStr: string;
  assets?: {
    chainAggregation: { token: { chainId: number }; amountInUSD: number }[];
  }[];
  address?: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(150deg,var(--ab) 0%,var(--ad) 100%)",
        borderRadius: 24,
        padding: "clamp(20px,3vw,28px)",
        color: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,.05),0 26px 50px -30px var(--ashd)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -40,
          top: -40,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "rgba(255,255,255,.1)",
        }}
      />
      <div style={{ position: "relative" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, opacity: 0.85 }}>Your balance</p>
        <p
          style={{
            margin: "4px 0 2px",
            fontSize: "clamp(38px,6vw,52px)",
            fontWeight: 800,
            letterSpacing: "-.03em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {balanceStr}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.82 }}>
          one balance · every chain · no chain picker
        </p>
        <ChainChips assets={assets} />
        {address && (
          <button
            onClick={onCopy}
            style={{
              marginTop: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,.14)",
              border: "1px solid rgba(255,255,255,.25)",
              borderRadius: 999,
              padding: "8px 13px",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
            }}
            title="Deposit USDC to this address on any supported chain"
          >
            <CopyIcon size={14} />
            {copied ? "Address copied ✓" : `Deposit · ${short(address)}`}
          </button>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => window.open(onRampUrl(address), "_blank", "noopener")}
            style={{
              flex: "1 1 130px",
              background: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "11px 14px",
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--ap)",
              cursor: "pointer",
            }}
            title="Buy USDC with a card or bank — lands in your Beam account on Arbitrum"
          >
            Add money
          </button>
          {address && <ReceiveModal address={address} />}
          <button
            onClick={() => window.open(offRampUrl(address), "_blank", "noopener")}
            style={{
              flex: "1 1 130px",
              background: "rgba(255,255,255,.14)",
              border: "1px solid rgba(255,255,255,.3)",
              borderRadius: 12,
              padding: "11px 14px",
              fontSize: 13.5,
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
            }}
            title="Cash out USDC to your bank or card"
          >
            Cash out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Real chain breakdown rendered as translucent pills on the gradient hero. */
function ChainChips({
  assets,
}: {
  assets?: {
    chainAggregation: { token: { chainId: number }; amountInUSD: number }[];
  }[];
}) {
  if (!assets?.length) return null;
  const byChain = new Map<number, number>();
  for (const a of assets)
    for (const c of a.chainAggregation)
      if (c.amountInUSD > 0)
        byChain.set(c.token.chainId, (byChain.get(c.token.chainId) ?? 0) + c.amountInUSD);
  const rows = [...byChain.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  const dot: Record<number, string> = {
    8453: "#0052FF",
    42161: "#28A0F0",
    1: "#9AB0F0",
    56: "#F0B90B",
    137: "#8247E5",
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
      {rows.map(([id, amt]) => (
        <div
          key={id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(255,255,255,.16)",
            borderRadius: 999,
            padding: "6px 11px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: dot[id] ?? "#cfc2ff",
            }}
          />
          {chainName(id)} {usd(amt)}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Quick actions ────────────────────────────── */

function QuickActions({ onMode }: { onMode: (m: Direction) => void }) {
  const items: { label: string; icon: React.ReactNode; onClick: () => void; href?: string }[] = [
    { label: "Send", icon: <SendIcon size={20} />, onClick: () => onMode("send") },
    { label: "Request", icon: <RequestIcon size={20} />, onClick: () => onMode("request") },
    { label: "Split", icon: <SplitIcon size={20} />, onClick: () => onMode("split") },
    { label: "Pay", icon: <ScanIcon size={20} />, onClick: () => {}, href: "/pay" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
      {items.map((q) => {
        const inner = (
          <>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                background: "var(--at)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ap)",
              }}
            >
              {q.icon}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#3a453e" }}>{q.label}</span>
          </>
        );
        const style: React.CSSProperties = {
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: "14px 8px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(16,21,18,.04)",
        };
        return q.href ? (
          <Link key={q.label} href={q.href} style={style}>
            {inner}
          </Link>
        ) : (
          <button key={q.label} onClick={q.onClick} style={style}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────── Link form (pay people / create campaign) ─────────── */

const MODES: { key: Direction; label: string }[] = [
  { key: "send", label: "Send" },
  { key: "request", label: "Request" },
  { key: "split", label: "Split" },
  { key: "fund", label: "Fund" },
  { key: "product", label: "Sell" },
];

const REASON_ICON: Record<Exclude<Reason, "none">, React.ReactNode> = {
  rent: <HomeIcon size={15} />,
  split: <SplitIcon size={15} />,
  gift: <GiftIcon size={15} />,
  tip: <TipIcon size={15} />,
};

function LinkForm({
  address,
  senderName,
  senderEmail,
  onCreated,
  mode,
  setMode,
}: {
  address: string;
  senderName?: string;
  senderEmail?: string;
  onCreated: () => void;
  mode: Direction;
  setMode: (m: Direction) => void;
}) {
  const { sendUsdcToArbitrum } = useUniversalAccount();
  const [amount, setAmount] = useState("");
  const [ways, setWays] = useState("");
  const [title, setTitle] = useState("");
  const [unlockUrl, setUnlockUrl] = useState("");
  const [reason, setReason] = useState<Reason>("none");
  const [note, setNote] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<BeamLink | null>(null);
  const [copied, setCopied] = useState(false);

  const isCreate = mode === "fund" || mode === "product";
  const isProduct = mode === "product";
  const isFund = mode === "fund";
  const isSplit = mode === "split";
  const amtNum = Number(amount);
  const canCreate = !!amount && amtNum > 0 && (!isCreate || !!title);

  const create = async () => {
    setBusy(true);
    setError(null);
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
          senderEmail,
          splitWays: isSplit ? Number(ways) || undefined : undefined,
        }),
      });
      if (res.ok) {
        const link: BeamLink = await res.json();

        // "send" = escrow: lock the funds NOW so the recipient is guaranteed to
        // get paid, with no need for the sender to return online. Falls back to
        // the legacy sender-pays-on-claim flow if no relayer is configured.
        if (mode === "send") {
          const relayer = await fetch("/api/relayer")
            .then((r) => r.json())
            .catch(() => null);
          if (relayer?.configured && relayer.address) {
            setFunding("Locking funds in escrow…");
            const dep = await sendUsdcToArbitrum(amount, relayer.address);
            setFunding("Confirming deposit…");
            // Retries while the cross-chain deposit lands on Arbitrum.
            await settleReport(`/api/links/${link.id}/fund`, {
              txId: dep.transactionId,
            });
            link.status = "funded";
          }
        }

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setFunding(null);
    }
  };

  const reset = () => {
    setCreated(null);
    setError(null);
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
      if (navigator.share) await navigator.share({ title: "Beam", text, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* user cancelled share */
    }
  };

  /* ── Created state ── */
  if (created) {
    const d = created.direction;
    const headline =
      d === "request"
        ? "Request ready — share it"
        : d === "fund"
          ? "Campaign live — share it"
          : d === "product"
            ? "Product live — share it"
            : d === "split"
              ? "Split ready — share it"
              : "Link ready — share it";
    const url = claimUrl(created.id);
    return (
      <div id="create" className="card animate-pop">
        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#79857c" }}>
          {headline}
        </p>
        <p style={{ margin: "0 0 18px", fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
          {created.title ? `${created.title} · ` : `${REASON_META[created.reason].emoji} `}
          {usd(created.amountUsd)}
          {d === "product" ? " each" : d === "fund" ? " goal" : ""}
        </p>
        {d === "send" && created.status === "funded" && (
          <p
            style={{
              margin: "-10px 0 16px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#1e7d54",
              background: "#e7f6ee",
              border: "1px solid #bde6cf",
              borderRadius: 999,
              padding: "5px 11px",
            }}
          >
            🔒 Funded in escrow — payout guaranteed on claim
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
          <Qr url={url} size={147} />
          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 13,
                color: "var(--ap)",
                background: "var(--at)",
                borderRadius: 12,
                padding: "11px 13px",
                wordBreak: "break-all",
                fontWeight: 500,
              }}
            >
              {url}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={share}>
                {copied ? "Copied ✓" : "Share link"}
              </button>
              <button className="btn btn-ghost" onClick={reset} style={{ background: "var(--field)", border: "1px solid var(--line)", color: "#3a453e" }}>
                New
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form state ── */
  const subtitle = isFund
    ? "Crowdfund — anyone chips in toward your goal"
    : isProduct
      ? "Sell a program — buyers pay, then unlock"
      : mode === "request"
        ? "Request money — they pay with a tap"
        : isSplit
          ? "Split a bill — everyone pays their share"
          : "Send money — they claim it with a tap";
  const suffix =
    isFund ? "goal" : isProduct ? "each" : isSplit && Number(ways) >= 2 && amount
      ? `${usd(amtNum / Number(ways))} ea`
      : null;
  const createLabel = funding
    ? funding
    : busy
      ? "Creating…"
      : mode === "request"
        ? "Create request link"
        : isSplit
          ? "Create split link"
          : isFund
            ? "Launch campaign"
            : isProduct
              ? "List product"
              : mode === "send"
                ? "Lock funds & create link"
                : "Create payment link";

  return (
    <div id="create" className="card">
      {/* mode tabs */}
      <div
        style={{
          display: "flex",
          background: "#f2f5f1",
          borderRadius: 14,
          padding: 4,
          gap: 3,
          marginBottom: 16,
        }}
      >
        {MODES.map((t) => {
          const on = mode === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setMode(t.key);
                setReason("none");
              }}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 11,
                padding: "9px 4px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: on ? "var(--ink)" : "transparent",
                color: on ? "#fff" : "#79857c",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#79857c" }}>{subtitle}</p>

      {isCreate && (
        <input
          className="input"
          style={{ marginBottom: 12 }}
          placeholder={isProduct ? "Product name" : "Campaign title"}
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
      )}

      {/* amount */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--field)",
          border: "1px solid var(--line-2)",
          borderRadius: 16,
          padding: "6px 16px",
          marginBottom: 14,
        }}
      >
        <span style={{ fontSize: 30, fontWeight: 800, color: "#b7c0b8" }}>$</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0"
          style={{
            flex: 1,
            width: "100%",
            border: "none",
            background: "transparent",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: "-.02em",
            color: "var(--ink)",
            outline: "none",
            fontVariantNumeric: "tabular-nums",
            minWidth: 0,
            fontFamily: "inherit",
          }}
        />
        {suffix && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#9aa69d" }}>{suffix}</span>
        )}
      </div>

      {isSplit && (
        <input
          className="input"
          style={{ marginBottom: 14 }}
          inputMode="numeric"
          placeholder="Split how many ways? (e.g. 4)"
          value={ways}
          onChange={(e) => setWays(e.target.value.replace(/[^0-9]/g, ""))}
        />
      )}

      {isProduct && (
        <input
          className="input"
          style={{ marginBottom: 14 }}
          placeholder="Unlock link revealed after purchase (course, file, invite…)"
          value={unlockUrl}
          maxLength={500}
          onChange={(e) => setUnlockUrl(e.target.value)}
        />
      )}

      {!isCreate && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {PRESETS.map((r) => (
            <button
              key={r}
              className="chip"
              data-active={reason === r}
              onClick={() => setReason(reason === r ? "none" : r)}
            >
              <span style={{ display: "flex", color: reason === r ? "var(--ap)" : "#9aa69d" }}>
                {REASON_ICON[r as Exclude<Reason, "none">]}
              </span>
              {REASON_META[r].label}
            </button>
          ))}
        </div>
      )}

      <input
        className="input"
        style={{ marginBottom: 14 }}
        placeholder={isCreate ? "Description (optional)" : "What's it for? (optional)"}
        value={note}
        maxLength={140}
        onChange={(e) => setNote(e.target.value)}
      />

      {(mode === "send" || mode === "request") && (
        <input
          className="input"
          style={{ marginBottom: 16 }}
          type="email"
          inputMode="email"
          placeholder="Email it to them (optional)"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
        />
      )}

      <button
        onClick={create}
        disabled={!canCreate || busy}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 14,
          padding: 15,
          fontSize: 15,
          fontWeight: 700,
          color: "#fff",
          cursor: canCreate && !busy ? "pointer" : "not-allowed",
          background: canCreate ? "var(--ac)" : "var(--adm)",
          boxShadow: canCreate ? "0 12px 24px -12px var(--ash)" : "none",
        }}
      >
        {createLabel}
      </button>

      {mode === "send" && (
        <p style={{ margin: "10px 2px 0", fontSize: 12, color: "#79857c", textAlign: "center" }}>
          Funds are locked in escrow now — the recipient is guaranteed to get
          paid the moment they claim.
        </p>
      )}
      {error && (
        <p style={{ margin: "10px 2px 0", fontSize: 12.5, color: "#c0392b", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────── @handle card ─────────────────────────────── */

function HandleCard({ address }: { address: string }) {
  const { signMessage } = useMagic();
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
      // Prove we control this address by signing the claim (matches the server).
      const message = `Beam username claim\nhandle: ${input.trim().toLowerCase()}\naddress: ${address.toLowerCase()}`;
      const signature = await signMessage(message);
      const res = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, name: input, signature }),
      });
      const d = await res.json();
      if (d.ok) setName(d.username);
      else setError(d.error ?? "Couldn't claim that handle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't claim that handle");
    } finally {
      setBusy(false);
    }
  };

  const url =
    name && typeof window !== "undefined" ? `${window.location.origin}/u/${name}` : "";

  if (name) {
    return (
      <div
        id="handle"
        style={{ background: "var(--ink)", borderRadius: 20, padding: 20, color: "#fff" }}
      >
        <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "#8fa395" }}>
          Your pay-me link
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 800, letterSpacing: "-.01em" }}>
          @{name}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            style={{
              flex: 1,
              background: "#fff",
              border: "none",
              borderRadius: 12,
              padding: 11,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <Link
            href={`/u/${name}`}
            style={{
              background: "rgba(255,255,255,.12)",
              border: "1px solid rgba(255,255,255,.2)",
              borderRadius: 12,
              padding: "11px 16px",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            View page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="handle" className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#79857c" }}>
        Claim your @handle — a permanent link anyone can pay you at
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--field)",
          border: "1px solid var(--line-2)",
          borderRadius: 13,
          padding: "0 14px",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, color: "#9aa69d" }}>@</span>
        <input
          placeholder="yourname"
          value={input}
          maxLength={20}
          onChange={(e) => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && input && claim()}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            padding: "12px 0",
            fontSize: 15,
            outline: "none",
            color: "var(--ink)",
            fontFamily: "inherit",
          }}
        />
      </div>
      <button
        className="btn btn-primary"
        disabled={input.length < 3 || busy}
        onClick={claim}
      >
        {busy ? "Claiming…" : "Claim handle"}
      </button>
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

/* ───────────────────────────── Activity feed ────────────────────────────── */

const ACT_ICON: Record<
  Direction,
  { bg: string; color: string; icon: (s: number) => React.ReactNode }
> = {
  send: { bg: "var(--at)", color: "var(--ap)", icon: (s) => <SendIcon size={s} /> },
  request: { bg: "#eaf0ff", color: "#2f6bff", icon: (s) => <RequestIcon size={s} /> },
  split: { bg: "#f1ecff", color: "#7c5cff", icon: (s) => <SplitIcon size={s} /> },
  fund: { bg: "#fff1e6", color: "#e8893b", icon: (s) => <GiftIcon size={s} /> },
  product: { bg: "#ffedf3", color: "#e5487d", icon: (s) => <StoreIcon size={s} /> },
};

function Activity({
  links,
  payingId,
  onPay,
  onRefund,
  onCollect,
}: {
  links: BeamLink[];
  payingId: string | null;
  onPay: (link: BeamLink) => void;
  onRefund: (link: BeamLink) => void;
  onCollect: (link: BeamLink) => void;
}) {
  return (
    <div id="activity" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>
          Activity
        </h3>
      </div>

      {!links.length ? (
        <div className="card" style={{ textAlign: "center", color: "#79857c", fontSize: 14 }}>
          Your sent links, requests and campaigns show up here.
        </div>
      ) : (
        links.map((l) =>
          isCampaign(l.direction) ? (
            <CampaignRow
              key={l.id}
              link={l}
              onCollect={onCollect}
              busy={payingId === l.id}
            />
          ) : (
            <ActivityRow
              key={l.id}
              link={l}
              payingId={payingId}
              onPay={onPay}
              onRefund={onRefund}
            />
          ),
        )
      )}
    </div>
  );
}

function ActivityRow({
  link: l,
  payingId,
  onPay,
  onRefund,
}: {
  link: BeamLink;
  payingId: string | null;
  onPay: (link: BeamLink) => void;
  onRefund: (link: BeamLink) => void;
}) {
  const ic = ACT_ICON[l.direction] ?? ACT_ICON.send;
  const expired = isExpired(l);
  const sub =
    l.status === "pending"
      ? l.direction === "request"
        ? "Waiting for payment"
        : "Waiting to be claimed"
      : l.status === "funded"
        ? expired
          ? `⏰ Unclaimed for ${daysWaiting(l)} days — reclaim it`
          : "🔒 Funded in escrow — waiting to be claimed"
        : l.status === "claiming"
          ? `${l.claimantEmail ?? short(l.claimantAddress)} is ${l.direction === "request" ? "paying" : "claiming"}`
          : l.status === "sending"
            ? "Settling on Arbitrum…"
            : l.status === "refunded"
              ? "Refunded to you"
              : l.direction === "request"
                ? "Received on Arbitrum"
                : "Settled on Arbitrum";
  const showPay = l.direction === "send" && l.status === "claiming";
  const showRefund = l.direction === "send" && l.status === "funded";
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        padding: 15,
        boxShadow: "0 1px 2px rgba(16,21,18,.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: ic.bg,
            color: ic.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {ic.icon(20)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {usd(l.amountUsd)}
            <span style={{ fontSize: 12, fontWeight: 500, color: "#9aa69d", marginLeft: 6 }}>
              {l.direction === "request" ? "request" : "sent"}
            </span>
          </p>
          <p
            style={{
              margin: "1px 0 0",
              fontSize: 12,
              color: "#79857c",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub}
          </p>
        </div>
        {showPay ? (
          <button
            onClick={() => onPay(l)}
            disabled={payingId === l.id}
            style={{
              background: "var(--ac)",
              border: "none",
              borderRadius: 11,
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              cursor: payingId === l.id ? "default" : "pointer",
              whiteSpace: "nowrap",
              opacity: payingId === l.id ? 0.6 : 1,
            }}
          >
            {payingId === l.id ? "Sending…" : `Send ${usd(l.amountUsd)}`}
          </button>
        ) : showRefund ? (
          <button
            onClick={() => onRefund(l)}
            disabled={payingId === l.id}
            style={{
              background: expired ? "var(--ac)" : "var(--field)",
              border: expired ? "none" : "1px solid var(--line)",
              borderRadius: 11,
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 700,
              color: expired ? "#fff" : "#3a453e",
              cursor: payingId === l.id ? "default" : "pointer",
              whiteSpace: "nowrap",
              opacity: payingId === l.id ? 0.6 : 1,
            }}
          >
            {payingId === l.id ? "…" : expired ? `Reclaim ${usd(l.amountUsd)}` : "Refund"}
          </button>
        ) : (
          <Badge tone={l.status === "paid" ? "success" : "muted"}>
            {l.status === "paid"
              ? "Paid"
              : l.status === "sending"
                ? "Sending"
                : l.status === "funded"
                  ? "Funded"
                  : l.status === "refunded"
                    ? "Refunded"
                    : l.status === "expired"
                      ? "Expired"
                      : l.direction === "request"
                        ? "Requested"
                        : "Pending"}
          </Badge>
        )}
      </div>
    </div>
  );
}

/** Activity row for a campaign (split / fund / product) — progress + counts. */
function CampaignRow({
  link,
  onCollect,
  busy,
}: {
  link: BeamLink;
  onCollect: (link: BeamLink) => void;
  busy: boolean;
}) {
  const target = Number(link.amountUsd);
  const collected = campaignRaisedUsd(link);
  const canCollect = (link.verifiedUsd ?? 0) > 0.009;
  const n = link.contributions?.length ?? 0;
  const isProduct = link.direction === "product";
  const isFund = link.direction === "fund";
  const pct = Math.min(100, target > 0 ? (collected / target) * 100 : 0);
  const heading =
    link.title || `${(REASON_META[link.reason] ?? REASON_META.none).emoji} ${usd(target)}`;
  const ic = ACT_ICON[link.direction] ?? ACT_ICON.send;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        padding: 15,
        boxShadow: "0 1px 2px rgba(16,21,18,.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: ic.bg,
            color: ic.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {ic.icon(20)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {heading}
            <span style={{ fontSize: 12, fontWeight: 500, color: "#9aa69d", marginLeft: 6 }}>
              {link.direction}
            </span>
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 12, color: "#79857c" }}>
            {isProduct
              ? `${usd(target)} each · ${usd(collected)} earned`
              : isFund
                ? `${usd(collected)} raised of ${usd(target)}`
                : `${usd(collected)} of ${usd(target)}`}
          </p>
        </div>
        <Badge tone={link.status === "paid" ? "success" : "muted"}>
          {link.status === "paid"
            ? "Funded"
            : `${n} ${isProduct ? (n === 1 ? "sale" : "sales") : n === 1 ? "payer" : "payers"}`}
        </Badge>
      </div>
      {!isProduct && (
        <div
          style={{
            height: 7,
            borderRadius: 999,
            background: "#eef1ed",
            marginTop: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{ height: "100%", borderRadius: 999, background: "var(--ac)", width: `${pct}%` }}
          />
        </div>
      )}
      {canCollect && (
        <button
          onClick={() => onCollect(link)}
          disabled={busy}
          style={{
            marginTop: 12,
            width: "100%",
            background: "var(--ac)",
            border: "none",
            borderRadius: 11,
            padding: "9px 14px",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Collecting…" : `Collect ${usd(link.verifiedUsd ?? 0)} to your account`}
        </button>
      )}
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
      style={{
        flexShrink: 0,
        borderRadius: 999,
        padding: "5px 11px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: tone === "success" ? "var(--at)" : "#f2f5f1",
        color: tone === "success" ? "var(--ap)" : "#5e6b62",
      }}
    >
      {children}
    </span>
  );
}

/* ───────────────────────────── Small shared bits ────────────────────────── */

function BeamMark({ size, radius }: { size: number; radius: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "var(--ac)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 22px -8px var(--ash)",
        color: "#fff",
      }}
    >
      <BeamBolt size={size * 0.53} />
    </div>
  );
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--ink)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {initials}
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "18px 0",
        color: "#9aa69d",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
      {children}
      <span style={{ height: 1, flex: 1, background: "var(--line)" }} />
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={navStyle(active)}>
      <span style={{ display: "flex", width: 20, height: 20, color: active ? "var(--ap)" : "#9aa69d" }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} style={{ ...navStyle(false), textDecoration: "none" }}>
      <span style={{ display: "flex", width: 20, height: 20, color: "#9aa69d" }}>{icon}</span>
      {label}
    </Link>
  );
}

function navStyle(active?: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 12px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    width: "100%",
    textAlign: "left",
    background: active ? "var(--at)" : "transparent",
    color: active ? "var(--ink)" : "#79857c",
    fontFamily: "inherit",
  };
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={tabStyle(active)}>
      <span style={{ display: "flex", width: 22, height: 22 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function TabLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} style={{ ...tabStyle(false), textDecoration: "none" }}>
      <span style={{ display: "flex", width: 22, height: 22 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
    </Link>
  );
}

function tabStyle(active?: boolean): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    padding: "4px 10px",
    flex: 1,
    color: active ? "var(--ap)" : "#9aa69d",
    fontFamily: "inherit",
  };
}
