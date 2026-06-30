/**
 * Server-side Arbitrum on-chain reads — the trust anchor for Beam payments.
 *
 * The API never takes the client's word that a payment happened. Every reported
 * txId is verified here against the real Arbitrum receipt: it must be a USDC
 * transfer, succeeded, and have actually moved value to the expected address.
 *
 * Read-only. Uses a public RPC (override with ARBITRUM_RPC_URL).
 */

import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import { SETTLEMENT_USDC } from "./chains";

const RPC_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";

/** USDC has 6 decimals on Arbitrum. */
export const USDC_DECIMALS = 6;

/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
] as const;

let _provider: JsonRpcProvider | null = null;
function provider(): JsonRpcProvider {
  if (!_provider) _provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
  return _provider;
}

const eq = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** A 32-byte topic holds an address right-padded to the low 20 bytes. */
const topicToAddress = (topic: string) => "0x" + topic.slice(-40);

export type TransferCheck = {
  ok: boolean;
  /** Total USDC received by `to` in this tx, as a number. */
  amountUsd: number;
  /** The first sender observed transferring to `to`. */
  from?: string;
  error?: string;
};

/**
 * Verify that `txHash` is a confirmed Arbitrum tx in which at least
 * `minAmountUsd` USDC was transferred TO `to`. Sums all USDC Transfer logs
 * crediting `to` so a routed/aggregated settlement still verifies.
 *
 * A small tolerance absorbs UA slippage (≤1%) and rounding so a legitimate
 * settlement that lands a hair under the requested amount still passes.
 */
export async function verifyUsdcTransfer(
  txHash: string,
  to: string,
  minAmountUsd: number,
): Promise<TransferCheck> {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash))
    return { ok: false, amountUsd: 0, error: "malformed tx hash" };
  try {
    const receipt = await provider().getTransactionReceipt(txHash);
    if (!receipt) return { ok: false, amountUsd: 0, error: "tx not found" };
    if (receipt.status !== 1)
      return { ok: false, amountUsd: 0, error: "tx reverted" };

    let received = BigInt(0);
    let from: string | undefined;
    for (const log of receipt.logs) {
      if (!eq(log.address, SETTLEMENT_USDC)) continue;
      if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      if (log.topics.length < 3) continue;
      if (!eq(topicToAddress(log.topics[2]), to)) continue;
      received += BigInt(log.data);
      if (!from) from = topicToAddress(log.topics[1]);
    }

    const amountUsd = Number(formatUnits(received, USDC_DECIMALS));
    // 1% slippage tolerance + a 1-cent floor for rounding dust.
    const threshold = Math.max(0, minAmountUsd * 0.99 - 0.01);
    if (amountUsd + 1e-9 < threshold)
      return {
        ok: false,
        amountUsd,
        from,
        error: `received $${amountUsd} but expected ~$${minAmountUsd}`,
      };
    return { ok: true, amountUsd, from };
  } catch (err) {
    return {
      ok: false,
      amountUsd: 0,
      error: err instanceof Error ? err.message : "rpc error",
    };
  }
}

/** Current USDC balance (in USD units) of an address on Arbitrum. */
export async function usdcBalanceOf(address: string): Promise<number> {
  const c = new Contract(SETTLEMENT_USDC, ERC20_ABI, provider());
  const raw: bigint = await c.balanceOf(address);
  return Number(formatUnits(raw, USDC_DECIMALS));
}
