<div align="center">

# ⚡ Beam

### Send money by link. Any chain. They claim it with Google.

**Live demo → [beam-encoder.vercel.app](https://beam-encoder.vercel.app)**

Beam is a chain-abstracted consumer payments app — Cash App–style **payment links with walletless claim**. A sender pays from whatever crypto they hold on whatever chain; the recipient claims with a Google or email login (no wallet, no seed phrase, no app); everything settles as USDC on **Arbitrum**.

Money is **guaranteed in escrow** the moment a link is created, campaign totals are **verified on-chain**, and the full fiat lifecycle is covered — **add money** with a card and **cash out** to a bank, all without the user ever touching a chain, a gas token, or a seed phrase.

The crypto is invisible. That's the whole point.

</div>

---

## Table of contents

- [The problem](#the-problem)
- [How Beam works](#how-beam-works)
- [Features](#features)
- [The technology](#the-technology)
  - [Particle Universal Accounts (EIP-7702)](#1-particle-universal-accounts--eip-7702)
  - [Magic embedded wallet](#2-magic-embedded-wallet-walletless-onboarding)
  - [Arbitrum settlement](#3-arbitrum-settlement)
  - [Escrow & on-chain trust](#4-escrow--on-chain-trust)
  - [Fiat on-ramp / cash-out & deposit-sweep](#5-fiat-on-ramp--cash-out--deposit-sweep)
- [Architecture](#architecture)
- [The payment-link lifecycle](#the-payment-link-lifecycle)
- [Trust & money safety](#trust--money-safety)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Engineering notes & decisions](#engineering-notes--decisions)
- [Security](#security)
- [Limitations & roadmap](#limitations--roadmap)

---

## The problem

Sending crypto to someone who doesn't already have a wallet is miserable:

1. Tell them to download a wallet.
2. Walk them through a seed phrase.
3. Find out which chain they're on.
4. Make sure *you* hold the right token on the right chain.
5. Pay gas in the chain's native token.
6. Hope nobody fat-fingers an address.

Every one of those steps loses a normal person. Beam removes **all of them**. The sender doesn't think about chains or tokens; the recipient doesn't even need a wallet. It feels like sending a link — because it is.

## How Beam works

The entire experience is one link and one tap:

1. **Alice signs in with Google** (or email). Behind the scenes her login key becomes a chain-abstracted account — *no new address shown*.
2. **Her dashboard shows one balance in USD**, aggregated across every chain. She never picks a chain. She can **add money** with a card or **cash out** to her bank right there.
3. **Alice creates a $50 link** — picks a reason (Rent / Split / Gift / Tip). The $50 is **locked in escrow** as she creates it, and she gets a shareable URL with a rich preview.
4. **Bob opens the link. He has no wallet.** He signs in with Google and instantly has a chain-abstracted account.
5. **The $50 pays out to Bob automatically and settles as USDC on Arbitrum** the instant he claims — sourced from escrow, with no need for Alice to be online. Bob can then **cash out to his bank** in one tap.
6. **Both sides update live** with a success animation and a real Arbiscan settlement link. If nobody ever claims, Alice **reclaims** her money.

## Features

Beam started as one-to-one send links and grew into a full chain-abstracted money app:

| | Feature | What it does |
| --- | --- | --- |
| 💸 | **Send links (guaranteed escrow)** | Creator pays; the recipient claims **walletless** (Google/email). Funds are **locked in escrow at create-time** and pay out **automatically on claim** — guaranteed even if the sender goes offline. The core wedge: the recipient needs no wallet. |
| ↩️ | **Reclaim unclaimed money** | If nobody claims a send link, the sender pulls the funds back from escrow. Links **soft-expire after 7 days** with a "Reclaim $X" nudge so money is never stranded. |
| 🙋 | **Request links** | The opener pays the creator. The inverse of send, same one-tap settle on Arbitrum. |
| 📥 | **Receive from anyone (QR)** | Show a QR of your address so **anyone — even on MetaMask or an exchange, no Beam account** — can pay you directly. No request link needed; an optional amount builds an EIP-681 USDC request. |
| 🔀 | **Auto deposit-sweep** | USDC that lands on another chain (e.g. someone paid your QR from Base) is **detected and auto-routed to Arbitrum** via Particle, so everything consolidates in one place. |
| 📷 | **Pay anyone** | Pay any external wallet by **address or ENS** (`name.eth`), or **scan their QR**. The universal scanner also opens Beam link QRs. Settles USDC to them on Arbitrum. |
| 🍕 | **Split / group pay (verified)** | One link, **many payers** from different chains, into a per-campaign escrow. The "$X collected" total is the **real on-chain balance** — auto-closes and sweeps to the creator when the target is hit. |
| 🎯 | **Crowdfunding (verified)** | Open, goal-based campaigns — anyone backs any amount toward a target. Raised-vs-goal is **verified on-chain**; the creator **collects** to their account anytime. |
| 🛒 | **Sell paid programs** | Reusable fixed-price product links — unlimited buyers, each pays the price into verifiable escrow. **Pay-to-unlock**: buyers reveal the content (course/file/invite) only after paying. |
| 💳 | **Add money (fiat on-ramp)** | Buy USDC with a card or bank via Particle's hosted ramp; it lands in your Beam account on Arbitrum. |
| 🏦 | **Cash out (fiat off-ramp)** | Sell USDC to your bank — surfaced on the dashboard and right on the recipient's "money received" screen, closing the loop for a walletless user. |
| 🏪 | **Creator storefront** | `/u/<name>` lists a creator's campaigns & products in one shareable page. |
| @ | **Username pay-links** | Claim a permanent `/u/<name>` handle (like a Cash-App `$cashtag`) — a reusable "pay me" link, with QR. Claims are **signature-gated** so handles can't be squatted. |
| 📱 | **QR codes** | Every link/handle/address gets a scannable QR — share to a screen, claim on a phone. |
| 🛰️ | **Cross-chain routing viz** | On every settle, an animation shows funds flowing **source chain(s) → Arbitrum**, derived from the real transaction. |
| 🔎 | **On-chain proof** | Success screens link to **USDC transfers on Arbiscan**, the real payout tx, plus the UniversalX activity. |
| ⛽ | **$0-gas badge** | Surfaces UA gas abstraction when fees are waived. |
| ✨ | **7702 onboarding moment** | A one-time "securing your account" overlay on first login that hides the EIP-7702 upgrade ("no wallet, no seed phrase"). |
| 📊 | **Unified balance + per-chain breakdown** | One USD number, with chips showing where the money actually lives. |
| 📲 | **Installable PWA** | Manifest + icon + theme color — "Add to Home Screen," feels native. Mobile has a tap-to-open account sheet (who's signed in + log out). |
| ✉️ | **Email delivery (optional)** | Email a link straight to a recipient via Resend (gated; no-ops without a key). |
| 🔔 | **Paid notifications** | "💰 you got paid $X" to the creator and "🎉 you received $X" to a walletless recipient the moment a payment settles (optional, via Resend). Live dashboard updates too. |

Every flow settles on **Arbitrum** via Universal Accounts and onboards with **Magic** — the three sponsor technologies are load-bearing, not decorative.

## The technology

Beam is built around three technologies, each doing something essential — not bolted on.

### 1. Particle Universal Accounts + EIP-7702

[Universal Accounts](https://developers.particle.network/universal-accounts/overview) give every user a **single balance and identity across chains**, with automatic cross-chain liquidity routing. Beam runs them in **EIP-7702 mode**: the user's login EOA is *upgraded in place* into the Universal Account via a Type-4 transaction — no new address, no asset migration, no "connect wallet" friction.

This is what makes the magic real:

- **One USD balance** across Ethereum, Base, Arbitrum, and more — read with `getPrimaryAssets()` and rendered as a single number (the dashboard even shows the per-chain breakdown, so you can *see* the aggregation).
- **Cross-chain settlement in a single call** — `createTransferTransaction()` targets USDC on Arbitrum, and the SDK sources and routes liquidity from wherever the sender actually holds funds. The account needs *nothing* on Arbitrum beforehand.
- **Split pay leans on this hard** — N people, each holding different tokens on different chains, all settle to one address on Arbitrum through the same API.
- **In-place EOA upgrade via 7702** — pending delegations are signed inline per user-operation and submitted with the transaction.
- **Made visible** — each settle reads the real source chains and gas-waiver status (`freeGasFee`) from the transaction and animates the source → Arbitrum routing, so the abstraction is something you can watch.

The EIP-7702 signing/authorization logic lives in [`src/providers/UniversalAccountProvider.tsx`](src/providers/UniversalAccountProvider.tsx).

### 2. Magic embedded wallet (walletless onboarding)

[Magic](https://magic.link) provides the signer. The recipient is the hard case — **they have no wallet yet** — and Magic solves exactly that:

- **Google One-Tap** (`@magic-ext/oauth2` + Google Identity Services) and **email OTP** (`magic-sdk`) — both produce a real EOA signer with no seed phrase.
- That signer becomes the **owner of the Universal Account**, and crucially, Magic can produce the **EIP-7702 authorization signature** (`magic.wallet.sign7702Authorization`) that standard JSON-RPC wallets cannot.
- Same email via Google or OTP resolves to the **same wallet** (Magic auto-link), so users never see two addresses.

Login lives in [`src/providers/MagicProvider.tsx`](src/providers/MagicProvider.tsx); the Google One-Tap helper is [`src/lib/gsi.ts`](src/lib/gsi.ts).

### 3. Arbitrum settlement

Every claim lands as **native USDC on Arbitrum One** (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`). Arbitrum is the canonical settlement layer for Beam: fast, cheap, deep USDC liquidity — the right place for money to actually *arrive*, regardless of where it came from. Settlement targets are defined in [`src/lib/chains.ts`](src/lib/chains.ts).

### 4. Escrow & on-chain trust

A payments app can't take the client's word that money moved. Beam holds funds in escrow and verifies everything against the chain.

- **Send links are real escrow.** At create-time the sender's UA deposits USDC into a Beam-controlled **relayer wallet** ([`src/lib/relayer.ts`](src/lib/relayer.ts)); on claim, the server pays the recipient from it. Payout is **guaranteed** and independent of the sender being online.
- **Deposits are verified on-chain.** The UA SDK returns only an opaque activity id (no destination tx hash), so verification reads the relayer's **real Arbitrum USDC balance** ([`src/lib/arbitrum.ts`](src/lib/arbitrum.ts)) and reconciles it against an atomic reserved-amount ledger — a link is only `funded` once the money has actually landed.
- **Campaign totals are verified, not self-reported.** Each split/fund/product link gets its **own deposit address**, derived deterministically from the relayer key. "$X raised" is that address's real on-chain balance; the creator **collects** it to their account, and a split auto-closes + sweeps when the verified target is hit.
- **Replay-protected & rate-limited.** Reported settlement ids can't be reused; every mutating route is per-IP rate-limited; addresses, URLs, and emails are validated; user input is HTML-escaped. Username claims are **signature-gated** (the caller signs with their Magic key to prove ownership). See [`src/lib/validate.ts`](src/lib/validate.ts), [`src/lib/ratelimit.ts`](src/lib/ratelimit.ts), [`src/lib/auth.ts`](src/lib/auth.ts).

### 5. Fiat on-ramp / cash-out & deposit-sweep

The lifecycle is complete: money gets in and out as fiat, and inbound crypto consolidates automatically.

- **Add money / Cash out** use Particle Network's hosted ramp ([`src/lib/ramp.ts`](src/lib/ramp.ts)) — a KYC-compliant widget deep-linked with the user's address, so bought USDC lands in Beam and cash-outs sell to a bank. Particle was chosen over Magic (whose ramp doesn't support Arbitrum and forces its own wallet UI) and Circle (no consumer fiat ramp).
- **Auto deposit-sweep.** When someone pays your Receive QR from another chain, the funds arrive on *that* chain (the address is the same across EVM chains). Beam detects the off-Arbitrum USDC and **auto-routes it to Arbitrum** via a UA self-transfer — once per session, skipping dust. (It's one-tap-or-auto, not silent server-side, because only the user's Magic session can sign the move.)

## Architecture

A single Next.js (App Router) application — UI, API, and chain logic in one deployable.

```
┌───────────────────────────────────────────────────────────────────┐
│                        Next.js App (Vercel)                         │
│                                                                     │
│  Browser (client)                      Server (route handlers)      │
│  ┌────────────────────────┐            ┌──────────────────────────┐ │
│  │ MagicProvider          │            │ /api/links (CRUD)        │ │
│  │  • Google / email login│            │ /api/links/[id]/         │ │
│  │  • EIP-7702 signer      │           │   claim·sending·paid·    │ │
│  │ UniversalAccountProvider│           │   contribute·fund·       │ │
│  │  • UA init (7702 mode)  │           │   refund·collect·unlock  │ │
│  │  • unified balance       │          │ /api/relayer·username    │ │
│  │  • cross-chain transfer  │          │ /api/notify·health       │ │
│  │  • deposit-sweep         │          └─────┬────────────┬───────┘ │
│  └────────────┬───────────┘                  │            │         │
│   Dashboard · Create · Receive QR    ┌───────▼──────┐  ┌──▼───────┐ │
│   Add money · Cash out (ramp)        │ Link+handle  │  │ Escrow   │ │
│   Claim /claim/[id] · /u/[username]  │ store +      │  │ relayer  │ │
│                                      │ reserved     │  │ wallet + │ │
│                                      │ ledger       │  │ on-chain │ │
│                                      │ Upstash/KV ⇄ │  │ verify   │ │
│                                      │ memory       │  │ (USDC)   │ │
│                                      └──────────────┘  └────┬─────┘ │
└──────────────┬─────────────────────────────────────────────┼───────┘
               │                                              │
     ┌─────────▼──────────┐   ┌──────────────────────┐        │
     │ Magic (signer +    │   │ Particle Universal   │        ▼
     │ walletless login)  │──▶│ Accounts (7702) +    │──▶ Arbitrum (USDC) ◀── relayer
     │                    │   │ hosted fiat ramp     │       settlement      payouts
     └────────────────────┘   └──────────────────────┘
```

## The payment-link lifecycle

Every link carries a **direction**:

- **send** — the creator funds **escrow** at create-time; the recipient claims walletless and is **paid out automatically** (shown below). Unclaimed funds are reclaimable, and links soft-expire after 7 days.
- **request** — the opener pays the creator directly on a tap.
- **split** — many openers each pay a share into a **per-campaign escrow** via `/contribute`; the verified on-chain total auto-closes + sweeps to the creator once it fills.
- **fund** — open crowdfunding: many backers pay any amount toward a goal; stays open (goal is a target, not a cap). The creator **collects** the verified balance anytime.
- **product** — a reusable fixed-price listing: each buyer pays into escrow, then unlocks the content (`/unlock` is gated to addresses that paid; `unlockUrl` is never returned by public GETs).

For a **send** link, Beam uses **real escrow**: the money is locked the moment the link is created, and the recipient is paid out **automatically** the instant they claim — it no longer depends on the sender returning online. Funds settle to a Beam-controlled relayer wallet on Arbitrum at create-time, and the server pays the recipient from it on claim.

```
Sender (Alice)                      Link store / Relayer            Recipient (Bob)
──────────────                      ────────────────────            ───────────────
create $50 link ───────────────────▶ pending
  └─ UA cross-chain deposit ───────▶ relayer wallet (Arbitrum)
     /fund verifies escrow balance ▶ funded  (money LOCKED)
                                       │  ◀──── opens link, logs in (Magic)
                                       │  ◀──── /claim records his address
     relayer pays Bob (Arbitrum) ────▶ sending → paid ────────────▶ "🎉 $50 received"
```

- `pending` → link created, deposit not yet confirmed.
- `funded` → escrow holds the money on Arbitrum; payout to the claimant is **guaranteed**. (Unclaimed? The sender can `/refund` it back.)
- `sending` → relayer payout in flight.
- `paid` → settled on Arbitrum to the recipient; both sides show success + a real payout tx on Arbiscan.

Escrow deposits are verified **on-chain** by reconciling the relayer's real USDC balance against a reserved-amount ledger — a link can only be marked `funded` once the money has actually landed. When no relayer is configured, Beam falls back to the legacy sender-pays-on-claim flow. Polling (3–4s) on both screens keeps the demo's two windows in lockstep.

## Trust & money safety

How Beam makes sure money is real, guaranteed, and never stranded:

| Concern | How Beam handles it |
| --- | --- |
| **Is the recipient guaranteed to get paid?** | Funds are locked in escrow at create-time; the server pays out on claim regardless of the sender. |
| **Did the money actually arrive?** | Escrow deposits and campaign totals are verified against the **real on-chain USDC balance** on Arbitrum, not the client's word. |
| **Can payment state be forged?** | Reported settlement ids are replay-protected; campaign totals derive from chain balance; mutating routes are rate-limited and input-validated. |
| **Can a handle be squatted?** | Username claims require a **Magic-signed message** proving the caller controls the address. |
| **What if nobody claims my link?** | The sender **reclaims** from escrow; links soft-expire after 7 days with a reclaim nudge. |
| **What if money lands on the wrong chain?** | Inbound USDC on any chain is detected and **auto-swept to Arbitrum** via UA. |
| **How does a walletless recipient get cash?** | One-tap **cash out to a bank** on the "money received" screen — no chains, gas, or exchanges. |

> Trade-off, stated plainly: the relayer escrow is **custodial while funds are in flight** (a server-held hot wallet). It's the right call for a hackathon — guaranteed payouts with no contract to deploy. The non-custodial successor is an on-chain escrow contract (see roadmap).

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router) + **React 19** |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (custom fintech design system, mobile-first) |
| Chain abstraction | `@particle-network/universal-account-sdk` (EIP-7702 mode) |
| Wallet / auth | `magic-sdk`, `@magic-ext/evm`, `@magic-ext/oauth2` (Google One-Tap) |
| Signing / on-chain | `ethers` v6 (UA signing, escrow payouts, Arbitrum balance reads) |
| Escrow | Server-held relayer wallet + reserved-amount ledger + per-campaign derived addresses |
| Fiat ramp | Particle Network hosted on-ramp / off-ramp (deep-linked) |
| Store | Upstash Redis / Vercel KV (REST) with in-memory fallback |
| QR / email | `qrcode.react` (generate) · `qr-scanner` (camera) · Resend (optional) |
| Hosting | Vercel (installable PWA) |
| Package manager | pnpm |

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Landing + Dashboard (pay people / create a campaign, @handle)
│   ├── claim/[id]/
│   │   ├── page.tsx             # Server component — Open Graph link previews
│   │   └── ClaimClient.tsx      # Claim/pay UI for all 5 directions (incl. product unlock)
│   ├── u/[username]/
│   │   ├── page.tsx             # @handle storefront (server + OG)
│   │   └── UserPayClient.tsx    # Pay a handle + list the creator's campaigns/products
│   ├── pay/page.tsx             # Pay anyone: address / ENS / universal QR scan
│   ├── api/
│   │   ├── links/route.ts       # POST create · GET list-by-sender (unlockUrl stripped)
│   │   ├── links/[id]/route.ts  # GET one (+ campaign escrowAddress; unlockUrl stripped)
│   │   ├── links/[id]/claim/    # POST recipient claims → relayer auto-payout from escrow
│   │   ├── links/[id]/fund/     # POST lock escrow at create (on-chain balance reconcile)
│   │   ├── links/[id]/refund/   # POST sender reclaims an unclaimed funded link
│   │   ├── links/[id]/sending/  # POST sender approved, settling (legacy path)
│   │   ├── links/[id]/paid/     # POST settled (txId, replay-protected)
│   │   ├── links/[id]/contribute/  # POST a campaign payment → verify on-chain total
│   │   ├── links/[id]/collect/  # POST creator withdraws a campaign's verified balance
│   │   ├── links/[id]/unlock/   # GET product content — gated to addresses that paid
│   │   ├── relayer/route.ts     # GET escrow deposit address + configured status
│   │   ├── username/route.ts    # GET resolve/availability · POST claim handle (signed)
│   │   ├── notify/route.ts      # POST email a link (Resend, optional)
│   │   └── health/route.ts      # Store + relayer + provider diagnostics
│   ├── manifest.ts              # PWA manifest
│   ├── providers.tsx            # Wraps the app in both providers
│   └── globals.css              # Design tokens + animations
├── providers/
│   ├── MagicProvider.tsx        # Login (Google/email) + EOA signer + signMessage
│   └── UniversalAccountProvider.tsx  # UA init, balance, 7702, transfer, deposit-sweep
├── lib/
│   ├── chains.ts                # Chain IDs, USDC, settlement target, explorer links
│   ├── links.ts                 # Link/contribution/handle types + dual-backend store + escrow ledger
│   ├── relayer.ts               # Escrow holding wallet: payout, refund, per-campaign deposit + sweep
│   ├── arbitrum.ts              # On-chain reads: USDC balance + deposit confirmation
│   ├── validate.ts              # Address/URL/email validation + HTML escaping
│   ├── auth.ts                  # Signature-based address-ownership checks
│   ├── ratelimit.ts             # Per-IP rate limiting for mutating routes
│   ├── ramp.ts                  # Fiat on-ramp / cash-out URLs (Particle ramp)
│   ├── receive.ts               # Receive QR payloads (plain address / EIP-681)
│   ├── email.ts                 # Resend templates (creator + recipient paid)
│   ├── gsi.ts                   # Google One-Tap helper
│   ├── ens.ts                   # ENS name → address (Ethereum mainnet RPC)
│   ├── pay-target.ts            # Parse scanned/typed targets (address/ENS/Beam URL)
│   └── format.ts                # Display helpers
├── components/                  # GoogleGlyph · Qr · QrScan · ReceiveModal · SettleAnimation · OnboardingOverlay
├── types/particle-ua.d.ts       # Ambient types for the UA SDK
└── public/icon.svg              # App icon (PWA + favicon)
```

## Run it locally

Requirements: Node 20+, pnpm.

```bash
pnpm install
cp .env.example .env.local     # fill in credentials (see below)
pnpm dev                       # http://localhost:3000
```

Other scripts:

```bash
pnpm build       # production build
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
```

## Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` | [Particle dashboard](https://dashboard.particle.network/) → project |
| `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` | Particle dashboard → project |
| `NEXT_PUBLIC_PARTICLE_APP_ID` | Particle dashboard → create a **Web** app |
| `NEXT_PUBLIC_MAGIC_API_KEY` | [Magic dashboard](https://dashboard.magic.link/) → Publishable API key (`pk_live_…`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud → OAuth client (must match the ID in Magic's Google config). *Optional* — app falls back to email-only when unset. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash (or Vercel KV's `KV_REST_API_URL` / `KV_REST_API_TOKEN`). *Optional locally* — falls back to in-memory. Required in production. |
| `BEAM_RELAYER_PRIVATE_KEY` | The escrow holding wallet that makes "send" links guaranteed. Fund it with a little ETH (gas) + USDC on **Arbitrum**. **Server-only** — never prefix with `NEXT_PUBLIC_`. *Optional* — without it, send links fall back to sender-pays-on-claim. |
| `ARBITRUM_RPC_URL` | *Optional* — Arbitrum RPC for escrow verification + payouts (defaults to `https://arb1.arbitrum.io/rpc`). |
| `RESEND_API_KEY` / `RESEND_FROM` | [Resend](https://resend.com) — *optional*, enables the "email it to them" field. The app works without it. |

> **Note:** Universal Accounts cross-chain liquidity is **mainnet-only**, so transfers move real USDC. Keep demo amounts small.

## Deployment

Beam deploys to Vercel as-is. Three things to configure for a working production deploy:

1. **Environment variables** — set all of the above in Vercel → Settings → Environment Variables (the `NEXT_PUBLIC_*` ones and the Upstash pair). The Upstash vars are **server-side secrets** — do not prefix them with `NEXT_PUBLIC_`.
2. **Persistent store** — connect an Upstash Redis (or Vercel KV) store. Serverless instances don't share memory, so the link store must be external. Verify with `GET /api/health` → `"persistentStore": true`.
   - **Escrow relayer** (for guaranteed send links) — set `BEAM_RELAYER_PRIVATE_KEY` and fund that wallet with a little ETH (gas) + USDC on Arbitrum. The reserved-amount ledger lives in the same Redis store, so a persistent store is required for escrow in production. Verify the deposit address with `GET /api/relayer`.
3. **Origin allowlists** — add your deployed domain to:
   - Particle dashboard → Web app → **Domain**
   - Google Cloud → OAuth client → **Authorized JavaScript origins** (and publish the consent screen)
   - Magic dashboard → **Allowed Origins & Redirects**

`GET /api/health` reports store and provider configuration at a glance.

## Engineering notes & decisions

Real things discovered building on bleeding-edge SDKs:

- **EIP-7702 needs an embedded wallet.** Type-4 transactions carry an `authorizationList` signed by the EOA key — standard JSON-RPC wallets can't produce it. Magic exposes `sign7702Authorization`, which is why it's central rather than optional.
- **Magic returns `{ r, s, v }`**, not a serialized signature — Beam serializes it via `ethers.Signature.from(...)` before handing it to the UA SDK.
- **Magic can't sign chain-agnostic (chainId 0) authorizations**, so delegation is done per-userOp with concrete chain IDs taken from the transaction.
- **Universal Accounts is mainnet-only.** Cross-chain liquidity needs Primary Assets with real depth, so there are no testnets — settlement is Arbitrum One with live USDC.
- **Runtime vs. type resolution.** The UA SDK ships types but no `types` export condition. Pointing TypeScript at the `.d.ts` via `tsconfig` `paths` also remapped the bundler at runtime (the class became `undefined` in the browser). Fixed with a hand-written ambient declaration in `src/types/` so runtime always resolves the real package.
- **Pluggable store.** The link store presents one async interface over either Upstash/KV (production) or an in-memory map (local), selected at runtime — so local dev needs zero infra while production persists.
- **The SDK gives no destination tx hash.** `sendTransaction` returns only an opaque `transactionId` (a UniversalX activity id), so escrow can't be verified by receipt. Beam instead verifies by **balance reconciliation** — read the relayer's real Arbitrum USDC balance against a reserved-amount ledger — which needs no hash and proves the money landed.
- **Per-campaign escrow without a contract.** Each campaign's deposit address is derived deterministically from the relayer key (`keccak256(key + linkId)`), giving isolated, on-chain-verifiable totals with no per-campaign config and no Solidity to deploy. Sweeps to the creator gas-fund the derived child from the master wallet.
- **Auto-sweep can't be silent.** Moving a user's inbound off-chain USDC to Arbitrum needs a signature, and Magic never exposes the key — so the sweep is auto-fired client-side from the user's session (skipping dust), not by a background server.
- **Fiat ramp provider.** Particle's hosted ramp was chosen because it supports Arbitrum + sell, needs no new SDK/key, and reuses the UA story — where Magic's ramp doesn't support Arbitrum and Circle has no consumer fiat ramp.

## Security

- No secrets are committed. `.env*` is gitignored; only public (`NEXT_PUBLIC_*`) values reach the client bundle, by design.
- Upstash/KV credentials and the escrow relayer key (`BEAM_RELAYER_PRIVATE_KEY`) are **server-side only** — never `NEXT_PUBLIC_`, never bundled to the client.
- Universal Accounts have no private keys — ownership is delegated to the Magic-managed signer; the user authorizes each transaction.
- Funds never move without an explicit action: a **send** link locks escrow on the creator's signed deposit; **request**/campaign payments are signed by the payer; sweeps/reclaims/collects are signed/initiated by the owner.
- **On-chain verification** anchors trust: escrow deposits and campaign totals reconcile against the real Arbitrum USDC balance; reported settlement ids are **replay-protected**.
- **Auth & abuse resistance:** username claims are signature-gated (proof of address ownership); every mutating route is per-IP **rate-limited**; addresses, URLs, and emails are validated; user input is **HTML-escaped** in emails.
- A product's **unlock content is server-side only** — stripped from every public response and returned solely to an address that has paid (purchase response + `/unlock` gate).
- **Custody note:** the escrow relayer is a server-held hot wallet holding only in-flight funds — fund it minimally and dedicate it to Beam. Non-custodial escrow (a contract) is the planned successor.

## Limitations & roadmap

- **Demo settlement uses real mainnet USDC** (UA has no testnets) — amounts are intentionally tiny.
- **Escrow is custodial** (a server-held relayer wallet) while funds are in flight. The non-custodial successor is an **on-chain escrow contract** keyed by link id — same UX, no hot wallet.
- **Campaign deposit verification** reads on-chain balance; under heavy concurrency a contract with per-campaign accounting would be tighter than balance reconciliation.
- **Link expiry is soft** (computed on read, 7 days) — a scheduled job could auto-refund expired links without the sender acting.
- The "Arbitrum proof" links to the payout tx and the recipient's USDC transfers; the UA SDK exposes no per-leg destination hash for the cross-chain source.
- Roadmap: **non-custodial escrow contract**, gas-sponsored claims where UA allows, recurring/scheduled links, automated expiry refunds, and "type what you want to pay" natural-language entry.

### Shipped highlights

Guaranteed **escrow** send · **reclaim**/soft-expiry · request · **receive-from-anyone** QR · **verified** split/fund/product (per-campaign escrow) · **collect** to account · **add money** + **cash out** (fiat ramp) · auto **deposit-sweep** to Arbitrum · **@username** handles (signed) · pay anyone (address/ENS/QR) · cross-chain **routing viz** · Arbiscan proof · on-chain verification + rate limits + replay protection · $0-gas badge · EIP-7702 **onboarding moment** · installable **PWA** with mobile account menu · optional email delivery & paid notifications.

---

<div align="center">

**Cross-chain, walletless, escrow-guaranteed — feels like Cash App.**

Fiat in → send / request / verified campaigns → fiat out, without ever touching a chain.

[Live demo](https://beam-encoder.vercel.app) · Built on Particle Universal Accounts · Magic · Arbitrum

</div>
