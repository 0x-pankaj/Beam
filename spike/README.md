# Beam Spike — proving the stack

Two proofs of the same chain (Magic → Particle UA EIP-7702 → settle on Arbitrum).
The critical risk (can Magic's signer own a Particle UA in 7702 mode?) is already
**resolved**: Magic is an officially verified 7702 wallet for Particle UA
(`Particle-Network/ua-7702-magic-demo`). These spikes prove it end-to-end with
real credentials.

> ⚠️ **Universal Accounts is MAINNET-ONLY.** There are no testnets. Both spikes
> move a *tiny amount of REAL USDC*. Keep amounts small (cents).

## Prereqs (one-time)
1. Particle dashboard → create a project + Web app → copy Project ID, Client Key, App ID.
   https://dashboard.particle.network/
2. Magic dashboard → copy the Publishable API key (`pk_live_…`).
   https://dashboard.magic.link/
3. `cp .env.example .env.local` and fill it in.
4. Fund an EOA with a little USDC (or USDT/ETH) on a supported mainnet, e.g. Base.

## A) Headless spike — proves the $4,500 core (no browser)
```bash
pnpm spike
```
Uses a throwaway `SPIKE_PRIVATE_KEY` as the UA owner (stands in for Magic). Prints
the unified balance, signs the EIP-7702 authorization with ethers, sends a transfer
that settles on Arbitrum, and prints the activity link. Run this first — it's the
fastest way to confirm the Particle + Arbitrum half works.

## B) Browser spike — proves the Magic $500 link
```bash
pnpm dev    # then open http://localhost:3000/spike
```
Email-login with Magic → the EOA is upgraded to a Universal Account in-place →
shows one USD balance → "Delegate on Base" → "Send & settle on Arbitrum".
This runs on the **real spine providers** in `src/providers/`, so it doubles as
the foundation of the hero flow (production swaps email-OTP for Google login).

## What "pass" looks like
- Unified balance shows a non-zero `$` aggregated across chains.
- The transfer returns a `transactionId`; funds appear as USDC on Arbitrum to the receiver.
