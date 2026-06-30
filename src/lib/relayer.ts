/**
 * Beam relayer — the escrow holding wallet that guarantees recipients get paid.
 *
 * Flow: a sender's Universal Account deposits USDC to this wallet on Arbitrum at
 * create-time (funds locked). When a recipient claims, the server pays them out
 * from here. This makes "send" links real escrow: once funded, payout is
 * guaranteed and does NOT depend on the sender coming back online.
 *
 * SERVER-ONLY. The private key never reaches the client. Configure:
 *   BEAM_RELAYER_PRIVATE_KEY  — the holding wallet's key (hold USDC + a little ETH for gas)
 *   ARBITRUM_RPC_URL          — optional RPC override
 *
 * The wallet must hold ETH on Arbitrum for gas and USDC to pay out.
 *
 * Imported only by API routes. BEAM_RELAYER_PRIVATE_KEY is not a NEXT_PUBLIC_
 * var, so Next never includes it in the client bundle.
 */

import { JsonRpcProvider, Wallet, Contract, parseUnits } from "ethers";
import { SETTLEMENT_USDC } from "./chains";
import { USDC_DECIMALS, usdcBalanceOf } from "./arbitrum";

const RPC_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const KEY = process.env.BEAM_RELAYER_PRIVATE_KEY;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

let _wallet: Wallet | null = null;
function wallet(): Wallet {
  if (!KEY) throw new Error("relayer not configured (BEAM_RELAYER_PRIVATE_KEY)");
  if (!_wallet) {
    const provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
    _wallet = new Wallet(KEY, provider);
  }
  return _wallet;
}

/** Whether the relayer/escrow is configured on this deployment. */
export const relayerConfigured = (): boolean => !!KEY;

/** The escrow wallet's address — where senders deposit. Null if unconfigured. */
export function relayerAddress(): string | null {
  if (!KEY) return null;
  return wallet().address;
}

export type PayoutResult = { ok: boolean; txHash?: string; error?: string };

/**
 * Pay `amountUsd` USDC from the escrow wallet to `to` on Arbitrum.
 * Waits for one confirmation and returns the real tx hash.
 */
export async function payoutUsdc(
  to: string,
  amountUsd: string,
): Promise<PayoutResult> {
  if (!KEY) return { ok: false, error: "relayer not configured" };
  try {
    const w = wallet();
    const amount = parseUnits(String(amountUsd), USDC_DECIMALS);

    // Guard: don't broadcast a tx we know will revert for lack of funds.
    const balance = await usdcBalanceOf(w.address);
    if (balance + 1e-9 < Number(amountUsd))
      return {
        ok: false,
        error: `escrow underfunded: $${balance} < $${amountUsd}`,
      };

    const usdc = new Contract(SETTLEMENT_USDC, ERC20_ABI, w);
    const tx = await usdc.transfer(to, amount);
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1)
      return { ok: false, txHash: tx.hash, error: "payout reverted" };
    return { ok: true, txHash: tx.hash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "payout failed" };
  }
}
