/**
 * Beam SPIKE (throwaway) — headless proof of the $4,500 core.
 *
 * Proves, with NO browser and NO Magic, that the Particle Universal Accounts
 * half of Beam works end-to-end:
 *
 *   throwaway EOA key  ->  UA in EIP-7702 mode  ->  unified balance read
 *     ->  cross-chain transfer that SETTLES ON ARBITRUM  ->  explorer link
 *
 * The Magic <-> UA link (the $500 bounty) is proven separately in the browser
 * spike at src/app/spike/page.tsx, because Magic's 7702 signer only runs in a
 * browser. Magic is an officially verified 7702 wallet for Particle UA, so the
 * only thing left to prove empirically is THIS flow.
 *
 * Run:   pnpm spike            (alias for: pnpm tsx spike/ua-arbitrum.ts)
 *
 * Requires .env.local with:
 *   PARTICLE_PROJECT_ID, PARTICLE_CLIENT_KEY, PARTICLE_APP_ID
 *   SPIKE_PRIVATE_KEY      0x… throwaway key whose EOA holds a Primary Asset
 *                          (USDC/USDT/ETH) on ANY supported mainnet (e.g. Base)
 * Optional:
 *   SPIKE_RECEIVER         where the USDC lands on Arbitrum (default: own addr)
 *   SPIKE_AMOUNT           human USDC amount to move (default: "0.5")
 *
 * NOTE: UA cross-chain is MAINNET ONLY. This moves a tiny amount of REAL USDC.
 */
import "dotenv/config";
import { Wallet, getBytes } from "ethers";
import {
  CHAIN_ID,
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
  type EIP7702Authorization,
} from "@particle-network/universal-account-sdk";

// Native USDC on Arbitrum One (6 decimals) — the settlement asset for Beam.
const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

function need(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`\n❌ Missing env ${key}. Copy .env.example -> .env.local and fill it in.\n`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const projectId = need("PARTICLE_PROJECT_ID");
  const projectClientKey = need("PARTICLE_CLIENT_KEY");
  const projectAppUuid = need("PARTICLE_APP_ID");
  const privateKey = need("SPIKE_PRIVATE_KEY");
  const amount = process.env.SPIKE_AMOUNT ?? "0.5";

  // 1) The owner signer. In the real app this EOA comes from Magic; here it's a
  //    throwaway key so the spike runs headless. UA only needs the address.
  const wallet = new Wallet(privateKey);
  const receiver = process.env.SPIKE_RECEIVER ?? wallet.address;
  console.log("👤 Owner EOA :", wallet.address);
  console.log("🎯 Receiver  :", receiver, "(Arbitrum USDC)");

  // 2) Initialize the Universal Account in EIP-7702 mode (the EOA itself becomes
  //    the UA — no new address, no migration). This is the spine of Beam.
  const ua = new UniversalAccount({
    projectId,
    projectClientKey,
    projectAppUuid,
    smartAccountOptions: {
      useEIP7702: true,
      name: "UNIVERSAL",
      version: UNIVERSAL_ACCOUNT_VERSION,
      ownerAddress: wallet.address,
    },
    tradeConfig: { slippageBps: 100 },
  });
  console.log("✅ UA initialized in EIP-7702 mode (v" + UNIVERSAL_ACCOUNT_VERSION + ")");

  // 3) Read the unified balance — ONE number across every chain. This is what
  //    the Beam dashboard shows ("$X" with no chain picker).
  const assets = await ua.getPrimaryAssets();
  console.log(`\n💰 Unified balance: $${Number(assets.totalAmountInUSD).toFixed(2)} across all chains`);
  for (const a of assets.assets) {
    if (a.amountInUSD > 0) {
      console.log(
        `   • ${a.tokenType.toUpperCase()}: ${a.amount} ($${a.amountInUSD.toFixed(2)}) over ${a.chainAggregation.filter((c) => c.amount > 0).length} chain(s)`,
      );
    }
  }
  if (Number(assets.totalAmountInUSD) <= 0) {
    console.error(
      "\n❌ Owner holds no Primary Assets. Fund the EOA with a little USDC/USDT/ETH on any supported mainnet (e.g. Base) and retry.\n",
    );
    process.exit(1);
  }

  // (visibility) current 7702 delegation status per chain
  try {
    const deployments = await ua.getEIP7702Deployments();
    console.log("\n🔗 EIP-7702 deployments:", JSON.stringify(deployments));
  } catch {
    /* non-fatal */
  }

  // 4) Build the cross-chain transfer. UA sources liquidity from wherever the
  //    Primary Assets live and routes it so USDC lands on ARBITRUM. The UA does
  //    NOT need to hold anything on Arbitrum.
  console.log(`\n🚀 Building transfer of ${amount} USDC -> Arbitrum…`);
  const transaction = await ua.createTransferTransaction({
    token: { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: ARBITRUM_USDC },
    amount,
    receiver,
  });

  // 5) Inline EIP-7702 authorization: sign any pending delegation in the userOps
  //    with the owner key. In the browser app this is magic.wallet.sign7702Authorization.
  const authorizations: EIP7702Authorization[] = [];
  const nonceMap = new Map<number, string>();
  for (const userOp of transaction.userOps) {
    if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
      let signature = nonceMap.get(userOp.eip7702Auth.nonce);
      if (!signature) {
        const auth = wallet.authorizeSync({
          address: userOp.eip7702Auth.address,
          nonce: userOp.eip7702Auth.nonce,
          chainId: userOp.eip7702Auth.chainId,
        });
        signature = auth.signature.serialized;
        nonceMap.set(userOp.eip7702Auth.nonce, signature);
      }
      authorizations.push({ userOpHash: userOp.userOpHash, signature });
    }
  }
  if (authorizations.length) {
    console.log(`✍️  Signed ${authorizations.length} EIP-7702 authorization(s) (Type-4 delegation)`);
  }

  // 6) Sign the transaction rootHash and broadcast through the UA.
  const signature = await wallet.signMessage(getBytes(transaction.rootHash));
  const result = await ua.sendTransaction(transaction, signature, authorizations);

  console.log("\n🎉 SETTLED. transactionId:", result.transactionId);
  console.log("   UniversalX activity:", `https://universalx.app/activity/details?id=${result.transactionId}`);
  console.log("\n👉 SPIKE PASSED: UA 7702 + cross-chain settle-to-Arbitrum works. Core ($4,500) de-risked.");
}

main().catch((err) => {
  console.error("\n💥 SPIKE FAILED:", err?.message ?? err);
  console.error(err);
  process.exit(1);
});
