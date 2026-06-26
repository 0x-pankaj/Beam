// The Particle UA SDK ships types at dist/index.d.ts, but its package.json
// "exports" has no "types" condition, so `moduleResolution: bundler` can't find
// them — and a tsconfig `paths` mapping to the .d.ts breaks Turbopack at runtime
// (it would resolve the import to the type-only file, making the classes
// undefined in the browser). So we declare exactly the surface we use here.
// Runtime always resolves the real package via package.json "exports".
declare module "@particle-network/universal-account-sdk" {
  export enum CHAIN_ID {
    SOLANA_MAINNET = 101,
    ETHEREUM_MAINNET = 1,
    BSC_MAINNET = 56,
    BASE_MAINNET = 8453,
    XLAYER_MAINNET = 196,
    ARBITRUM_MAINNET_ONE = 42161,
    OPTIMISM_MAINNET = 10,
    POLYGON_MAINNET = 137,
    AVALANCHE_MAINNET = 43114,
    LINEA_MAINNET = 59144,
  }

  export enum SUPPORTED_TOKEN_TYPE {
    ETH = "eth",
    USDT = "usdt",
    USDC = "usdc",
    BTC = "btc",
    BNB = "bnb",
    SOL = "sol",
  }

  export const UNIVERSAL_ACCOUNT_VERSION: string;

  export interface EIP7702Authorization {
    userOpHash: string;
    signature: string;
  }

  export interface IBasicToken {
    chainId: number;
    address: string;
  }

  export interface IToken {
    chainId: number;
    address: string;
    decimals?: number;
    symbol?: string;
    name?: string;
  }

  export interface IChainAggregation {
    token: IToken;
    amount: number;
    amountInUSD: number;
    rawAmount: number;
  }

  export interface IAsset {
    tokenType: SUPPORTED_TOKEN_TYPE;
    price: number;
    amount: number;
    amountInUSD: number;
    chainAggregation: IChainAggregation[];
  }

  export interface IAssetsResponse {
    assets: IAsset[];
    totalAmountInUSD: number;
  }

  export interface ITransferTransaction {
    token: IBasicToken;
    amount: string;
    receiver: string;
  }

  export interface IUserOpWithChain {
    chainId: number;
    userOpHash: string;
    eip7702Auth?: { chainId: number; nonce: number; address: string };
    eip7702Delegated?: boolean;
  }

  export interface ITransaction {
    rootHash: string;
    userOps: IUserOpWithChain[];
    transactionId: string;
  }

  export interface ISmartAccountOptions {
    name: string;
    version: string;
    ownerAddress: string;
    useEIP7702?: boolean;
    smartAccountAddress?: string;
    solanaSmartAccountAddress?: string;
  }

  export interface ITradeConfig {
    slippageBps?: number;
    universalGas?: boolean;
    usePrimaryTokens?: SUPPORTED_TOKEN_TYPE[];
  }

  export interface IUniversalAccountConfig {
    projectId: string;
    projectClientKey: string;
    projectAppUuid: string;
    smartAccountOptions?: ISmartAccountOptions;
    tradeConfig?: ITradeConfig;
    rpcUrl?: string;
    ownerAddress?: string;
  }

  export class UniversalAccount {
    constructor(config: IUniversalAccountConfig);
    getPrimaryAssets(): Promise<IAssetsResponse>;
    getSmartAccountOptions(): Promise<ISmartAccountOptions>;
    getEIP7702Deployments(): Promise<unknown>;
    getEIP7702Auth(chainIds: number[]): Promise<{ address: string; nonce: number; chainId: number }[]>;
    createTransferTransaction(payload: ITransferTransaction): Promise<ITransaction>;
    sendTransaction(
      transaction: ITransaction,
      signature: string,
      authorizations?: EIP7702Authorization[],
    ): Promise<{ transactionId: string }>;
  }
}
