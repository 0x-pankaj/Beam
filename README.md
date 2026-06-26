# Beam

> Send money by link. Any chain. They claim it with Google.

Beam is a chain-abstracted consumer payments app — Cash App–style **payment links with walletless claim**. A sender pays from whatever crypto they hold on whatever chain; the recipient claims with a Google login (no wallet, no seed phrase); everything settles on **Arbitrum**. The crypto is invisible.

## How it works

- **Universal Accounts (Particle), EIP-7702 mode** — the user's login EOA is upgraded in-place into a chain-abstracted account. One balance in USD across chains, no chain picker, automatic cross-chain routing.
- **Embedded wallet (Magic)** — Google/email login produces the signer. No extension, no seed phrase. The recipient onboards in seconds with no prior wallet.
- **Settlement on Arbitrum** — every claim lands as USDC on Arbitrum One, sourced from the sender's scattered balances via Universal Accounts liquidity routing.

## Stack

Next.js (App Router) · TypeScript · Tailwind · `@particle-network/universal-account-sdk` · `magic-sdk` · `ethers`.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in Particle + Magic credentials
pnpm dev                     # http://localhost:3000
```

Required env (see `.env.example`):

- `NEXT_PUBLIC_PARTICLE_PROJECT_ID`, `NEXT_PUBLIC_PARTICLE_CLIENT_KEY`, `NEXT_PUBLIC_PARTICLE_APP_ID` — from the [Particle dashboard](https://dashboard.particle.network/) (create a **Web** app).
- `NEXT_PUBLIC_MAGIC_API_KEY` — publishable key from the [Magic dashboard](https://dashboard.magic.link/).

> Universal Accounts cross-chain liquidity is mainnet-only, so the app moves real USDC. Keep demo amounts small.

## Scripts

| command | what |
| --- | --- |
| `pnpm dev` | run locally |
| `pnpm build` | production build |
| `pnpm lint` | lint |
| `pnpm typecheck` | type-check |
