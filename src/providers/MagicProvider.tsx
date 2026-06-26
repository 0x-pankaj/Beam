"use client";

import { EVMExtension } from "@magic-ext/evm";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import { Magic as MagicBase } from "magic-sdk";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DELEGATION_CHAIN_ID } from "@/lib/chains";

export type Magic = MagicBase<[EVMExtension]>;

type MagicContextType = {
  magic: Magic | null;
  address: string | null;
  isLoggedIn: boolean;
  loginWithEmailOTP: (email: string) => Promise<string>;
  logout: () => Promise<void>;
};

const MagicContext = createContext<MagicContextType>({
  magic: null,
  address: null,
  isLoggedIn: false,
  loginWithEmailOTP: async () => "",
  logout: async () => {},
});

export const useMagic = () => useContext(MagicContext);

/** Derive the EOA address from Magic's EIP-1193 provider (version-stable). */
async function readAddress(m: Magic): Promise<string> {
  const provider = new BrowserProvider(
    (m as unknown as { rpcProvider: Eip1193Provider }).rpcProvider,
  );
  const signer = await provider.getSigner();
  return signer.getAddress();
}

export const MagicProvider = ({ children }: { children: ReactNode }) => {
  const [magic, setMagic] = useState<Magic | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAGIC_API_KEY;
    if (!key) return;

    const m = new MagicBase(key, {
      extensions: [
        new EVMExtension([
          {
            rpcUrl:
              process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
            chainId: DELEGATION_CHAIN_ID,
            default: true,
          },
        ]),
      ],
    });
    setMagic(m);

    // Restore session if the user is still logged in.
    m.user.isLoggedIn().then(async (loggedIn) => {
      if (loggedIn) {
        const addr = await readAddress(m);
        setAddress(addr);
        localStorage.setItem("user", addr);
      }
    });
  }, []);

  const loginWithEmailOTP = useCallback(
    async (email: string) => {
      if (!magic) throw new Error("Magic not ready");
      await magic.auth.loginWithEmailOTP({ email });
      const addr = await readAddress(magic);
      setAddress(addr);
      localStorage.setItem("user", addr);
      return addr;
    },
    [magic],
  );

  const logout = useCallback(async () => {
    if (magic) await magic.user.logout();
    setAddress(null);
    localStorage.removeItem("user");
  }, [magic]);

  const value = useMemo(
    () => ({
      magic,
      address,
      isLoggedIn: !!address,
      loginWithEmailOTP,
      logout,
    }),
    [magic, address, loginWithEmailOTP, logout],
  );

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
};
