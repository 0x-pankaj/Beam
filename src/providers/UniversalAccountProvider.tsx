"use client";

import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
  type IAssetsResponse,
} from "@particle-network/universal-account-sdk";
import { BrowserProvider, getBytes, Signature, type Eip1193Provider } from "ethers";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMagic } from "./MagicProvider";
import {
  DELEGATION_CHAIN_ID,
  SETTLEMENT_CHAIN_ID,
  SETTLEMENT_USDC,
} from "@/lib/chains";

type EIP7702Authorization = { userOpHash: string; signature: string };

/** Raw 7702 authorization Magic returns ({ r, s, v }). */
type Auth7702 = { r: string; s: string; v: number };

/** Magic surfaces these at runtime but doesn't type them — model the bits we use. */
type Magic7702 = {
  wallet: {
    sign7702Authorization: (p: {
      contractAddress: string;
      chainId: number;
      nonce?: number;
    }) => Promise<Auth7702>;
    send7702Transaction: (p: {
      to: string;
      data: string;
      authorizationList: Auth7702[];
    }) => Promise<unknown>;
  };
  evm: { switchChain: (chainId: number) => Promise<void> };
  rpcProvider: Eip1193Provider;
};

/** Shape of one entry from getEIP7702Deployments() (SDK types it as any). */
type Deployment = { chainId: number; isDelegated?: boolean };

/** What a settle returns — enough to visualize the cross-chain routing. */
export type SettleResult = {
  transactionId: string;
  freeGasFee: boolean;
  /** Chains the funds were sourced from (for the routing animation). */
  sourceChainIds: number[];
};

type UAContextType = {
  universalAccount: UniversalAccount | null;
  primaryAssets: IAssetsResponse | null;
  totalUsd: number;
  isDelegated: boolean;
  loading: boolean;
  refreshBalance: () => Promise<void>;
  ensureDelegated: () => Promise<void>;
  /** Move `amount` USDC cross-chain so it settles on Arbitrum to `receiver`. */
  sendUsdcToArbitrum: (amount: string, receiver: string) => Promise<SettleResult>;
  /** USDC the user holds OFF Arbitrum (e.g. inbound deposits on Base) — sweepable. */
  offArbitrumUsdc: number;
  /** Sweep all off-Arbitrum USDC onto Arbitrum (a UA self-transfer). */
  consolidateToArbitrum: () => Promise<SettleResult>;
};

const UAContext = createContext<UAContextType>({
  universalAccount: null,
  primaryAssets: null,
  totalUsd: 0,
  isDelegated: false,
  loading: false,
  refreshBalance: async () => {},
  ensureDelegated: async () => {},
  sendUsdcToArbitrum: async () => ({
    transactionId: "",
    freeGasFee: false,
    sourceChainIds: [],
  }),
  offArbitrumUsdc: 0,
  consolidateToArbitrum: async () => ({
    transactionId: "",
    freeGasFee: false,
    sourceChainIds: [],
  }),
});

export const useUniversalAccount = () => useContext(UAContext);

export const UniversalAccountProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { magic, address } = useMagic();
  const [universalAccount, setUniversalAccount] =
    useState<UniversalAccount | null>(null);
  const [primaryAssets, setPrimaryAssets] = useState<IAssetsResponse | null>(
    null,
  );
  const [isDelegated, setIsDelegated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize the Universal Account in EIP-7702 mode once we have the Magic EOA.
  useEffect(() => {
    if (!address) {
      setUniversalAccount(null);
      return;
    }
    const ua = new UniversalAccount({
      projectId: process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID!,
      projectClientKey: process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY!,
      projectAppUuid: process.env.NEXT_PUBLIC_PARTICLE_APP_ID!,
      smartAccountOptions: {
        useEIP7702: true,
        name: "UNIVERSAL",
        version: UNIVERSAL_ACCOUNT_VERSION,
        ownerAddress: address,
      },
      tradeConfig: { slippageBps: 100, universalGas: false },
    });
    setUniversalAccount(ua);
  }, [address]);

  const refreshDelegationStatus = useCallback(async () => {
    if (!universalAccount) return;
    const deployments = await universalAccount.getEIP7702Deployments();
    const d = (deployments as Deployment[]).find(
      (x) => x.chainId === DELEGATION_CHAIN_ID,
    );
    setIsDelegated(d?.isDelegated ?? false);
  }, [universalAccount]);

  const refreshBalance = useCallback(async () => {
    if (!universalAccount) return;
    const assets = await universalAccount.getPrimaryAssets();
    setPrimaryAssets(assets);
  }, [universalAccount]);

  useEffect(() => {
    if (!universalAccount || !address) return;
    (async () => {
      setLoading(true);
      try {
        await refreshDelegationStatus();
        await refreshBalance();
      } catch (err) {
        console.error("Failed to load UA data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [universalAccount, address, refreshDelegationStatus, refreshBalance]);

  // Magic returns { r, s, v }; serialize via ethers Signature for the SDK.
  const signEip7702Auth = useCallback(
    async (contractAddress: string, chainId: number, nonce?: number) => {
      if (!magic) throw new Error("Magic not ready");
      const m = magic as unknown as Magic7702;
      return m.wallet.sign7702Authorization({
        contractAddress,
        chainId,
        ...(nonce !== undefined && { nonce }),
      });
    },
    [magic],
  );

  // Pre-delegate the EOA on the delegation chain via a Type-4 transaction.
  // Magic cannot sign chain-agnostic (chainId 0) authorizations, so we must
  // delegate on a concrete chain before sending UA transactions.
  const ensureDelegated = useCallback(async () => {
    if (!universalAccount || !magic || !address)
      throw new Error("Account not ready");

    const deployments = await universalAccount.getEIP7702Deployments();
    const d = (deployments as Deployment[]).find(
      (x) => x.chainId === DELEGATION_CHAIN_ID,
    );
    if (d?.isDelegated) {
      await refreshDelegationStatus();
      return;
    }

    const m = magic as unknown as Magic7702;
    await m.evm.switchChain(DELEGATION_CHAIN_ID);
    const [auth] = await universalAccount.getEIP7702Auth([DELEGATION_CHAIN_ID]);
    const authorization = await signEip7702Auth(
      auth.address,
      DELEGATION_CHAIN_ID,
      auth.nonce + 1,
    );
    await m.wallet.send7702Transaction({
      to: address,
      data: "0x",
      authorizationList: [authorization],
    });
    await refreshDelegationStatus();
  }, [universalAccount, magic, address, signEip7702Auth, refreshDelegationStatus]);

  const sendUsdcToArbitrum = useCallback(
    async (amount: string, receiver: string) => {
      if (!universalAccount || !magic || !address)
        throw new Error("Account not ready");

      const transaction = await universalAccount.createTransferTransaction({
        token: { chainId: SETTLEMENT_CHAIN_ID, address: SETTLEMENT_USDC },
        amount,
        receiver,
      });

      // Inline EIP-7702 authorizations for any pending delegation in the userOps.
      const authorizations: EIP7702Authorization[] = [];
      const nonceMap = new Map<number, string>();
      for (const userOp of transaction.userOps) {
        if (userOp.eip7702Auth && !userOp.eip7702Delegated) {
          let serialized = nonceMap.get(userOp.eip7702Auth.nonce);
          if (!serialized) {
            const a = await signEip7702Auth(
              userOp.eip7702Auth.address,
              userOp.eip7702Auth.chainId || userOp.chainId,
              userOp.eip7702Auth.nonce,
            );
            serialized = Signature.from({ r: a.r, s: a.s, v: a.v }).serialized;
            nonceMap.set(userOp.eip7702Auth.nonce, serialized);
          }
          authorizations.push({
            userOpHash: userOp.userOpHash,
            signature: serialized,
          });
        }
      }

      const provider = new BrowserProvider(
        (magic as unknown as Magic7702).rpcProvider,
      );
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(getBytes(transaction.rootHash));
      const result = await universalAccount.sendTransaction(
        transaction,
        signature,
        authorizations.length ? authorizations : undefined,
      );
      await refreshBalance();

      // Where the funds came from, for the routing visualization.
      const sourceChainIds = Array.from(
        new Set(
          (transaction.depositTokens ?? [])
            .map((d) => d.token.chainId)
            .filter((c) => c !== SETTLEMENT_CHAIN_ID),
        ),
      );
      return {
        transactionId: (result as { transactionId: string }).transactionId,
        freeGasFee: transaction.transactionFees?.freeGasFee ?? false,
        sourceChainIds,
      };
    },
    [universalAccount, magic, address, signEip7702Auth, refreshBalance],
  );

  // USDC sitting on chains other than Arbitrum (e.g. someone paid the Receive QR
  // from Base) — the part a sweep would consolidate onto the settlement chain.
  const offArbitrumUsdc = useMemo(() => {
    if (!primaryAssets?.assets) return 0;
    let sum = 0;
    for (const a of primaryAssets.assets) {
      if (String(a.tokenType).toLowerCase() !== "usdc") continue;
      for (const c of a.chainAggregation ?? []) {
        if (c.token.chainId !== SETTLEMENT_CHAIN_ID) sum += Number(c.amount) || 0;
      }
    }
    return sum;
  }, [primaryAssets]);

  // Sweep: move off-Arbitrum USDC to the user's own address on Arbitrum. UA
  // sources the funds cross-chain, so the tokens physically consolidate.
  const consolidateToArbitrum = useCallback(async () => {
    if (!address) throw new Error("Account not ready");
    if (offArbitrumUsdc <= 0) throw new Error("Nothing to move to Arbitrum");
    return sendUsdcToArbitrum(offArbitrumUsdc.toFixed(6), address);
  }, [address, offArbitrumUsdc, sendUsdcToArbitrum]);

  const value = useMemo(
    () => ({
      universalAccount,
      primaryAssets,
      totalUsd: Number(primaryAssets?.totalAmountInUSD ?? 0),
      isDelegated,
      loading,
      refreshBalance,
      ensureDelegated,
      sendUsdcToArbitrum,
      offArbitrumUsdc,
      consolidateToArbitrum,
    }),
    [
      universalAccount,
      primaryAssets,
      isDelegated,
      loading,
      refreshBalance,
      ensureDelegated,
      sendUsdcToArbitrum,
      offArbitrumUsdc,
      consolidateToArbitrum,
    ],
  );

  return <UAContext.Provider value={value}>{children}</UAContext.Provider>;
};
