<div align="center">

# ⚡ Beam

### Send money by link. Any chain. They claim it with Google.

**Live demo → [beam-encoder.vercel.app](https://beam-encoder.vercel.app)**

Beam is a chain-abstracted consumer payments app — Cash App–style **payment links with walletless claim**. A sender pays from whatever crypto they hold on whatever chain; the recipient claims with a Google or email login (no wallet, no seed phrase, no app); everything settles as USDC on **Arbitrum**.

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
- [Architecture](#architecture)
- [The payment-link lifecycle](#the-payment-link-lifecycle)
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
2. **Her dashboard shows one balance in USD**, aggregated across every chain. She never picks a chain.
3. **Alice creates a $50 link** — picks a reason (Rent / Split / Gift / Tip), gets a shareable URL with a rich preview.
4. **Bob opens the link. He has no wallet.** He signs in with Google and instantly has a chain-abstracted account.
5. **Alice approves; the $50 moves cross-chain and settles as USDC on Arbitrum to Bob**, sourced automatically from her scattered balances.
6. **Both sides update live** with a success animation and a settlement link.

## Features

Beam started as one-to-one send links and grew into a full chain-abstracted money app:

| | Feature | What it does |
| --- | --- | --- |
| 💸 | **Send links** | Creator pays; the recipient claims **walletless** (Google/email). The core wedge — the recipient needs no wallet. |
| 🙋 | **Request links** | The opener pays the creator. The inverse of send, same one-tap settle on Arbitrum. |
| 🍕 | **Split / group pay** | One link, **many payers** from different chains. A live **progress bar** fills as each person pays their share; confetti when funded. |
| 🎯 | **Crowdfunding** | Open, goal-based campaigns — anyone backs any amount toward a target; raised-vs-goal updates live. |
| 🛒 | **Sell paid programs** | Reusable fixed-price product links — unlimited buyers, each pays the price. **Pay-to-unlock**: buyers reveal the content (course/file/invite) only after paying. |
| 🏪 | **Creator storefront** | `/u/<name>` lists a creator's campaigns & products in one shareable page. |
| @ | **Username pay-links** | Claim a permanent `/u/<name>` handle (like a Cash-App `$cashtag`) — a reusable "pay me" link, with QR. |
| 📱 | **QR codes** | Every link/handle gets a scannable QR — share to a screen, claim on a phone. |
| 🛰️ | **Cross-chain routing viz** | On every settle, an animation shows funds flowing **source chain(s) → Arbitrum**, derived from the real transaction. |
| 🔎 | **On-chain proof** | Success screens link to the recipient's **USDC transfers on Arbiscan** plus the UniversalX activity. |
| ⛽ | **$0-gas badge** | Surfaces UA gas abstraction when fees are waived. |
| ✨ | **7702 onboarding moment** | A one-time "securing your account" overlay on first login that hides the EIP-7702 upgrade ("no wallet, no seed phrase"). |
| 📊 | **Unified balance + per-chain breakdown** | One USD number, with chips showing where the money actually lives. |
| 📲 | **Installable PWA** | Manifest + icon + theme color — "Add to Home Screen," feels native. |
| ✉️ | **Email delivery (optional)** | Email a link straight to a recipient via Resend (gated; no-ops without a key). |

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

## Architecture

A single Next.js (App Router) application — UI, API, and chain logic in one deployable.

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js App (Vercel)                      │
│                                                                │
│  Browser (client)                     Server (route handlers)  │
│  ┌────────────────────────┐           ┌─────────────────────┐  │
│  │ MagicProvider          │           │ /api/links (CRUD)   │  │
│  │  • Google / email login│           │ /api/links/[id]/    │  │
│  │  • EIP-7702 signer      │          │   claim·sending·    │  │
│  │ UniversalAccountProvider│          │   paid·contribute   │  │
│  │  • UA init (7702 mode)  │          │ /api/username       │  │
│  │  • unified balance      │          │ /api/notify·health  │  │
│  │  • cross-chain transfer │          └──────────┬──────────┘  │
│  └────────────┬───────────┘                      │             │
│   Dashboard · Create (send/request/split)  ┌─────▼──────────┐  │
│   Claim /claim/[id] · Handle /u/[username] │ Link + handle  │  │
│                                            │ store          │  │
│                                            │ Upstash/KV ⇄   │  │
│                                            │ memory         │  │
│                                            └────────────────┘  │
└───────────────┬────────────────────────────────────────────────┘
                │
      ┌─────────▼──────────┐        ┌──────────────────────┐
      │ Magic (signer +    │        │ Particle Universal   │
      │ walletless login)  │───────▶│ Accounts (7702)      │───▶ Arbitrum (USDC)
      └────────────────────┘        └──────────────────────┘
```

## The payment-link lifecycle

Every link carries a **direction**:

- **send** — the creator funds and approves; the recipient claims walletless (shown below).
- **request** — the opener pays the creator on a tap.
- **split** — many openers each pay a share via `/contribute`; the link flips to `paid` once the total fills.
- **fund** — open crowdfunding: many backers pay any amount toward a goal; stays open (goal is a target, not a cap).
- **product** — a reusable fixed-price listing: each buyer pays the price, then unlocks the content (`/unlock` is gated to addresses that paid; `unlockUrl` is never returned by public GETs).

For a **send** link, funds move only on the sender's action — the recipient just claims. Status transitions are coordinated through the link store so the two parties' screens stay in sync in real time.

```
Sender (Alice)                      Link store                    Recipient (Bob)
──────────────                      ──────────                    ───────────────
create $50 link ───────────────────▶ pending
                                       │  ◀──── opens link, logs in (Magic)
                                     claiming ◀──── announces claim (his address)
sees "Bob is claiming"
taps "Send $50"
  ├─ mark sending ─────────────────▶ sending ────▶ "settling on Arbitrum…"
  ├─ UA cross-chain transfer
  │    → settles USDC on Arbitrum
  └─ mark paid (txId) ─────────────▶ paid ───────▶ "🎉 $50 received"
```

- `pending` → link created, not yet opened.
- `claiming` → recipient logged in; address captured for the sender.
- `sending` → sender approved; cross-chain settlement in flight.
- `paid` → settled on Arbitrum; both sides show success + settlement link.

Polling (3–4s) on both screens keeps the demo's two windows in lockstep.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router) + **React 19** |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (custom fintech design system, mobile-first) |
| Chain abstraction | `@particle-network/universal-account-sdk` (EIP-7702 mode) |
| Wallet / auth | `magic-sdk`, `@magic-ext/evm`, `@magic-ext/oauth2` |
| Signing | `ethers` v6 |
| Store | Upstash Redis / Vercel KV (REST) with in-memory fallback |
| Hosting | Vercel |
| Package manager | pnpm |

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Landing + Dashboard (send/request/split, @handle)
│   ├── claim/[id]/
│   │   ├── page.tsx             # Server component — Open Graph link previews
│   │   └── ClaimClient.tsx      # Walletless claim / pay / split UI
│   ├── u/[username]/
│   │   ├── page.tsx             # @handle pay page (server + OG)
│   │   └── UserPayClient.tsx    # Pay a username, settle on Arbitrum
│   ├── api/
│   │   ├── links/route.ts       # POST create · GET list-by-sender
│   │   ├── links/[id]/route.ts  # GET one
│   │   ├── links/[id]/claim/    # POST recipient announces claim
│   │   ├── links/[id]/sending/  # POST sender approved, settling
│   │   ├── links/[id]/paid/     # POST settled (txId)
│   │   ├── links/[id]/contribute/  # POST a split share
│   │   ├── username/route.ts    # GET resolve/availability · POST claim handle
│   │   ├── notify/route.ts      # POST email a link (Resend, optional)
│   │   └── health/route.ts      # Store + config diagnostics
│   ├── manifest.ts              # PWA manifest
│   ├── providers.tsx            # Wraps the app in both providers
│   └── globals.css              # Design tokens + animations
├── providers/
│   ├── MagicProvider.tsx        # Login (Google/email) + EOA signer
│   └── UniversalAccountProvider.tsx  # UA init, balance, 7702, transfer + settle result
├── lib/
│   ├── chains.ts                # Chain IDs, USDC, settlement target, explorer links
│   ├── links.ts                 # Link/contribution/handle types + dual-backend store
│   ├── gsi.ts                   # Google One-Tap helper
│   └── format.ts                # Display helpers
├── components/
│   ├── GoogleGlyph.tsx · Qr.tsx · SettleAnimation.tsx · OnboardingOverlay.tsx
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
| `RESEND_API_KEY` / `RESEND_FROM` | [Resend](https://resend.com) — *optional*, enables the "email it to them" field. The app works without it. |

> **Note:** Universal Accounts cross-chain liquidity is **mainnet-only**, so transfers move real USDC. Keep demo amounts small.

## Deployment

Beam deploys to Vercel as-is. Three things to configure for a working production deploy:

1. **Environment variables** — set all of the above in Vercel → Settings → Environment Variables (the `NEXT_PUBLIC_*` ones and the Upstash pair). The Upstash vars are **server-side secrets** — do not prefix them with `NEXT_PUBLIC_`.
2. **Persistent store** — connect an Upstash Redis (or Vercel KV) store. Serverless instances don't share memory, so the link store must be external. Verify with `GET /api/health` → `"persistentStore": true`.
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

## Security

- No secrets are committed. `.env*` is gitignored; only public (`NEXT_PUBLIC_*`) values reach the client bundle, by design.
- Upstash/KV credentials are server-side only and live in deployment env vars.
- Universal Accounts have no private keys — ownership is delegated to the Magic-managed signer; the user authorizes each transaction.
- Funds never move without an explicit action: a **send** link requires the creator's approval; **request**/**split** payments are signed by the payer.

## Limitations & roadmap

- **Demo settlement uses real mainnet USDC** (UA has no testnets) — amounts are intentionally tiny.
- The link/handle store is sized for a demo footprint; production would add auth on the mutating endpoints, rate limits, and link expiry.
- The "Arbitrum proof" links to the recipient's USDC transfers (the SDK returns a `transactionId`, not a destination tx hash) — a per-tx Arbiscan deep-link would be tighter if the SDK exposes it.
- Roadmap: "top up from any wallet" (use existing MetaMask funds to fund the Beam account), gas-sponsored claims where UA allows, recurring/scheduled links, and "type what you want to pay" natural-language entry.

### Shipped highlights

Send · request · **split/group** pay · **@username** handles · QR · cross-chain **routing visualization** · Arbiscan proof · $0-gas badge · EIP-7702 **onboarding moment** · installable **PWA** · optional email delivery.

---

<div align="center">

**Cross-chain, walletless, feels like Cash App.**

[Live demo](https://beam-encoder.vercel.app) · Built on Particle Universal Accounts · Magic · Arbitrum

</div>
