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

## The technology

Beam is built around three technologies, each doing something essential — not bolted on.

### 1. Particle Universal Accounts + EIP-7702

[Universal Accounts](https://developers.particle.network/universal-accounts/overview) give every user a **single balance and identity across chains**, with automatic cross-chain liquidity routing. Beam runs them in **EIP-7702 mode**: the user's login EOA is *upgraded in place* into the Universal Account via a Type-4 transaction — no new address, no asset migration, no "connect wallet" friction.

This is what makes the magic real:

- **One USD balance** across Ethereum, Base, Arbitrum, and more — read with `getPrimaryAssets()` and rendered as a single number (the dashboard even shows the per-chain breakdown, so you can *see* the aggregation).
- **Cross-chain settlement in a single call** — `createTransferTransaction()` targets USDC on Arbitrum, and the SDK sources and routes liquidity from wherever the sender actually holds funds. The account needs *nothing* on Arbitrum beforehand.
- **In-place EOA upgrade via 7702** — pending delegations are signed inline per user-operation and submitted with the transaction.

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
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App (Vercel)                      │
│                                                               │
│  Browser (client)                    Server (route handlers)  │
│  ┌───────────────────────┐           ┌──────────────────────┐ │
│  │ MagicProvider         │           │ /api/links  (CRUD)   │ │
│  │  • Google / email login│          │ /api/links/[id]/...  │ │
│  │  • EIP-7702 signer     │          │   claim · sending ·  │ │
│  │                        │          │   paid               │ │
│  │ UniversalAccountProvider│         │ /api/health          │ │
│  │  • UA init (7702 mode) │          └──────────┬───────────┘ │
│  │  • unified balance     │                     │             │
│  │  • cross-chain transfer│          ┌──────────▼───────────┐ │
│  └───────────┬───────────┘           │ Link store           │ │
│              │                        │  Upstash/KV ⇄ memory │ │
│  Dashboard ─ Create link ─ Claim     └──────────────────────┘ │
└──────────────┼────────────────────────────────────────────────┘
               │
     ┌─────────▼──────────┐        ┌──────────────────────┐
     │ Magic (signer +    │        │ Particle Universal   │
     │ walletless login)  │───────▶│ Accounts (7702)      │───▶ Arbitrum (USDC)
     └────────────────────┘        └──────────────────────┘
```

## The payment-link lifecycle

A link is a money **request**: the sender stays in control and funds move only on their approval. Status transitions are coordinated through the link store so the two parties' screens stay in sync in real time.

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
│   ├── page.tsx                 # Landing (logged-out) + Dashboard (logged-in)
│   ├── claim/[id]/
│   │   ├── page.tsx             # Server component — Open Graph link previews
│   │   └── ClaimClient.tsx      # Walletless claim UI
│   ├── api/
│   │   ├── links/route.ts       # POST create · GET list-by-sender
│   │   ├── links/[id]/route.ts  # GET one
│   │   ├── links/[id]/claim/    # POST recipient announces claim
│   │   ├── links/[id]/sending/  # POST sender approved, settling
│   │   ├── links/[id]/paid/     # POST settled (txId)
│   │   └── health/route.ts      # Store + config diagnostics
│   ├── providers.tsx            # Wraps the app in both providers
│   └── globals.css              # Design tokens + animations
├── providers/
│   ├── MagicProvider.tsx        # Login (Google/email) + EOA signer
│   └── UniversalAccountProvider.tsx  # UA init, balance, 7702, transfer
├── lib/
│   ├── chains.ts                # Chain IDs, USDC addresses, settlement target
│   ├── links.ts                 # Link types + dual-backend store
│   ├── gsi.ts                   # Google One-Tap helper
│   └── format.ts                # Display helpers
├── components/GoogleGlyph.tsx
└── types/particle-ua.d.ts       # Ambient types for the UA SDK
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
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash (or Vercel KV's `KV_REST_API_URL` / `KV_REST_API_TOKEN`). *Optional locally* — falls back to in-memory. |

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
- Payment links are requests: funds never move without the sender's explicit approval.

## Limitations & roadmap

- **Demo settlement uses real mainnet USDC** (UA has no testnets) — amounts are intentionally tiny.
- Link store is keyed for a demo footprint; production would add auth on the sender/claim endpoints and expiry.
- Roadmap: sender-side auto-approve option, ENS/social-handle display for recipients, gas-sponsored claims where UA allows, and "type what you want to pay" natural-language entry.

---

<div align="center">

**Cross-chain, walletless, feels like Cash App.**

[Live demo](https://beam-encoder.vercel.app) · Built on Particle Universal Accounts · Magic · Arbitrum

</div>
