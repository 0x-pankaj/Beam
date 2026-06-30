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

import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseUnits,
  parseEther,
  keccak256,
  toUtf8Bytes,
} from "ethers";
import { SETTLEMENT_USDC } from "./chains";
import { USDC_DECIMALS, usdcBalanceOf } from "./arbitrum";

const RPC_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const KEY = process.env.BEAM_RELAYER_PRIVATE_KEY;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

let _provider: JsonRpcProvider | null = null;
function provider(): JsonRpcProvider {
  if (!_provider)
    _provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
  return _provider;
}

let _wallet: Wallet | null = null;
function wallet(): Wallet {
  if (!KEY) throw new Error("relayer not configured (BEAM_RELAYER_PRIVATE_KEY)");
  if (!_wallet) _wallet = new Wallet(KEY, provider());
  return _wallet;
}

/**
 * A unique escrow wallet per campaign, derived deterministically from the master
 * key so each campaign gets its OWN deposit address — its on-chain USDC balance
 * is then a provable, isolated "amount raised". No extra config: the same
 * BEAM_RELAYER_PRIVATE_KEY is the root for every derived campaign wallet.
 */
function campaignWallet(seed: string): Wallet {
  const childKey = keccak256(toUtf8Bytes(`${KEY}:campaign:${seed}`));
  return new Wallet(childKey, provider());
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

/* ─────────────────────────── Per-campaign escrow ─────────────────────────── */

/** The deposit address contributors pay into for a campaign. Null if unconfigured. */
export function campaignDepositAddress(seed: string): string | null {
  if (!KEY) return null;
  return campaignWallet(seed).address;
}

/** The real, on-chain USDC balance of a campaign's escrow — the verified total raised. */
export async function campaignBalanceUsd(seed: string): Promise<number> {
  if (!KEY) return 0;
  return usdcBalanceOf(campaignWallet(seed).address);
}

/**
 * Sweep a campaign's escrow balance to the creator. The derived wallet holds no
 * ETH, so we top it up with a little gas from the master first, then forward the
 * USDC. Returns the payout tx and the amount actually swept.
 */
export async function sweepCampaignTo(
  seed: string,
  to: string,
): Promise<PayoutResult & { amountUsd?: number }> {
  if (!KEY) return { ok: false, error: "relayer not configured" };
  try {
    const child = campaignWallet(seed);
    const amountUsd = await usdcBalanceOf(child.address);
    if (amountUsd <= 0) return { ok: false, error: "nothing to collect" };

    // Ensure the child can pay gas — top it up from the master if needed.
    const gasBal = await provider().getBalance(child.address);
    if (gasBal < parseEther("0.00004")) {
      const fund = await wallet().sendTransaction({
        to: child.address,
        value: parseEther("0.0001"),
      });
      await fund.wait(1);
    }

    const usdc = new Contract(SETTLEMENT_USDC, ERC20_ABI, child);
    const amount = parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);
    const tx = await usdc.transfer(to, amount);
    const receipt = await tx.wait(1);
    if (!receipt || receipt.status !== 1)
      return { ok: false, txHash: tx.hash, error: "sweep reverted" };
    return { ok: true, txHash: tx.hash, amountUsd };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "sweep failed" };
  }
}
