import { JsonRpcProvider } from "ethers";

// ENS lives on Ethereum mainnet regardless of where Beam settles (Arbitrum).
const ETH_RPC =
  process.env.NEXT_PUBLIC_ETH_RPC_URL ||
  "https://ethereum-rpc.publicnode.com";

let provider: JsonRpcProvider | null = null;
function ethProvider() {
  if (!provider) provider = new JsonRpcProvider(ETH_RPC, 1);
  return provider;
}

/** Resolve an ENS name (e.g. "vitalik.eth") to an address, or null. */
export async function resolveEns(name: string): Promise<string | null> {
  try {
    return await ethProvider().resolveName(name.trim());
  } catch {
    return null;
  }
}
