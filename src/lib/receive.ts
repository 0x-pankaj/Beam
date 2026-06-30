/**
 * QR payloads for receiving money directly — from ANYONE, including external
 * wallets (MetaMask, exchanges, any Beam-less sender). No request link, no login
 * on their side: they just scan your address and send.
 *
 * - No amount → a plain EVM address. Universally scannable; the sender picks the
 *   token and chain. Funds land on whatever chain they send on and show up in the
 *   recipient's unified Beam balance automatically.
 * - With an amount → an EIP-681 request prefilling a USDC transfer on Arbitrum,
 *   so supporting wallets fill in the token, amount, and recipient.
 */

import { SETTLEMENT_CHAIN_ID, SETTLEMENT_USDC } from "./chains";

const USDC_DECIMALS = 6;

export function receiveUri(address: string, amountUsd?: number): string {
  if (amountUsd && amountUsd > 0) {
    const base = BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));
    return `ethereum:${SETTLEMENT_USDC}@${SETTLEMENT_CHAIN_ID}/transfer?address=${address}&uint256=${base}`;
  }
  return address;
}
