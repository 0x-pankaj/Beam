/**
 * Server-side Arbitrum on-chain reads — the trust anchor for Beam escrow.
 *
 * The Particle UA SDK returns only an opaque `transactionId` (its activity id),
 * not a destination tx hash, so we cannot verify a settlement by receipt. We
 * instead verify escrow deposits by reading the relayer wallet's real on-chain
 * USDC balance and reconciling it against the amount already reserved (locked)
 * for funded links. That is genuine on-chain verification: a link can only be
 * marked "funded" once the money has actually landed in the escrow.
 *
 * Read-only. Uses a public RPC (override with ARBITRUM_RPC_URL).
 */

import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import { SETTLEMENT_USDC } from "./chains";

const RPC_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";

/** USDC has 6 decimals on Arbitrum. */
export const USDC_DECIMALS = 6;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
] as const;

let _provider: JsonRpcProvider | null = null;
function provider(): JsonRpcProvider {
  if (!_provider)
    _provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
  return _provider;
}

/** Current USDC balance (in USD units) of an address on Arbitrum. */
export async function usdcBalanceOf(address: string): Promise<number> {
  const c = new Contract(SETTLEMENT_USDC, ERC20_ABI, provider());
  const raw: bigint = await c.balanceOf(address);
  return Number(formatUnits(raw, USDC_DECIMALS));
}

const wait = (ms: number) =>
  new Promise((r) => {
    const t = setTimeout(r, ms);
    if (typeof t === "object" && "unref" in t) (t as { unref: () => void }).unref();
  });

/**
 * Poll until `address` holds at least `min` USDC, or until `tries` run out.
 * Absorbs the short lag between a cross-chain settlement and the balance being
 * readable on our RPC. Returns the final observed balance.
 */
export async function waitForUsdcBalance(
  address: string,
  min: number,
  tries = 6,
  intervalMs = 2500,
): Promise<number> {
  let balance = 0;
  for (let i = 0; i < tries; i++) {
    balance = await usdcBalanceOf(address);
    if (balance + 1e-9 >= min) return balance;
    if (i < tries - 1) await wait(intervalMs);
  }
  return balance;
}
