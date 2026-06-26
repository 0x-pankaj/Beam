/**
 * Beam chain + token constants.
 *
 * Chain IDs are plain literals (not the SDK's CHAIN_ID enum) so this module is
 * safe to evaluate during SSR — the Particle SDK's enum resolves to undefined
 * under Turbopack's server bundle. Values match CHAIN_ID from the SDK.
 *
 * IMPORTANT: Particle Universal Accounts cross-chain liquidity is MAINNET-ONLY.
 * There are no testnets. The demo moves tiny amounts of REAL USDC.
 */

export const CHAIN = {
  ETHEREUM: 1,
  BASE: 8453,
  ARBITRUM: 42161,
} as const;

/** Settlement chain for Beam — every claim lands here (Arbitrum bounty). */
export const SETTLEMENT_CHAIN_ID = CHAIN.ARBITRUM; // 42161

/** Chain we pre-delegate the EOA on (where the user's funds usually sit). */
export const DELEGATION_CHAIN_ID = CHAIN.BASE; // 8453

/** Native USDC token addresses (6 decimals) by chain. */
export const USDC: Record<number, string> = {
  [CHAIN.ARBITRUM]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [CHAIN.BASE]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [CHAIN.ETHEREUM]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

/** USDC on the settlement chain — the token a Beam recipient receives. */
export const SETTLEMENT_USDC = USDC[SETTLEMENT_CHAIN_ID];

export const arbiscanTx = (hash: string) => `https://arbiscan.io/tx/${hash}`;
export const universalxActivity = (id: string) =>
  `https://universalx.app/activity/details?id=${id}`;
