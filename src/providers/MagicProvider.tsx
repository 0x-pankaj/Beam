"use client";

import { EVMExtension } from "@magic-ext/evm";
import { OAuthExtension } from "@magic-ext/oauth2";
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
import { CHAIN, DELEGATION_CHAIN_ID } from "@/lib/chains";
import { emailFromIdToken, promptGoogleOneTap } from "@/lib/gsi";

export type Magic = MagicBase<[EVMExtension, OAuthExtension]>;

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type MagicContextType = {
  magic: Magic | null;
  address: string | null;
  email: string | null;
  isLoggedIn: boolean;
  /** True while a previous session is being restored on page load. */
  restoring: boolean;
  googleEnabled: boolean;
  loginWithEmailOTP: (email: string) => Promise<string>;
  loginWithGoogle: () => Promise<string>;
  /** Sign a plain message with the Magic EOA (proves address ownership). */
  signMessage: (message: string) => Promise<string>;
  logout: () => Promise<void>;
};

const MagicContext = createContext<MagicContextType>({
  magic: null,
  address: null,
  email: null,
  isLoggedIn: false,
  restoring: true,
  googleEnabled: false,
  loginWithEmailOTP: async () => "",
  loginWithGoogle: async () => "",
  signMessage: async () => "",
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
  const [email, setEmail] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAGIC_API_KEY;
    if (!key) {
      setRestoring(false);
      return;
    }

    const m = new MagicBase(key, {
      extensions: [
        new EVMExtension([
          {
            rpcUrl:
              process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org",
            chainId: DELEGATION_CHAIN_ID,
            default: true,
          },
          // Every chain ensureDelegated() may switch to needs to be listed
          // here — Magic's EVM extension rejects switchChain to unknown ids.
          {
            rpcUrl:
              process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ||
              "https://arb1.arbitrum.io/rpc",
            chainId: CHAIN.ARBITRUM,
          },
          {
            rpcUrl:
              process.env.NEXT_PUBLIC_ETH_RPC_URL ||
              "https://eth.llamarpc.com",
            chainId: CHAIN.ETHEREUM,
          },
        ]),
        new OAuthExtension(),
      ],
    });
    setMagic(m);

    // Optimistic restore: show the account instantly from the last session
    // hint so a refresh never flashes the login page, then verify with Magic
    // and clear if the session actually expired.
    const cached = localStorage.getItem("user");
    if (cached) {
      setAddress(cached);
      setEmail(localStorage.getItem("user_email"));
    }
    m.user
      .isLoggedIn()
      .then(async (loggedIn) => {
        if (loggedIn) {
          const addr = await readAddress(m);
          setAddress(addr);
          setEmail(localStorage.getItem("user_email"));
          localStorage.setItem("user", addr);
        } else {
          setAddress(null);
          setEmail(null);
          localStorage.removeItem("user");
          localStorage.removeItem("user_email");
        }
      })
      .finally(() => setRestoring(false));
  }, []);

  const loginWithEmailOTP = useCallback(
    async (emailInput: string) => {
      if (!magic) throw new Error("Magic not ready");
      await magic.auth.loginWithEmailOTP({ email: emailInput });
      const addr = await readAddress(magic);
      setAddress(addr);
      setEmail(emailInput);
      localStorage.setItem("user", addr);
      localStorage.setItem("user_email", emailInput);
      return addr;
    },
    [magic],
  );

  const loginWithGoogle = useCallback(async () => {
    if (!magic) throw new Error("Magic not ready");
    if (!GOOGLE_CLIENT_ID) throw new Error("Google login not configured");
    const jwt = await promptGoogleOneTap(GOOGLE_CLIENT_ID);
    await magic.oauth2.loginWithGoogleIdToken({
      jwt,
      googleClientId: GOOGLE_CLIENT_ID,
    });
    const addr = await readAddress(magic);
    const mail = emailFromIdToken(jwt);
    setAddress(addr);
    setEmail(mail);
    localStorage.setItem("user", addr);
    if (mail) localStorage.setItem("user_email", mail);
    return addr;
  }, [magic]);

  const signMessage = useCallback(
    async (message: string) => {
      if (!magic) throw new Error("Magic not ready");
      const provider = new BrowserProvider(
        (magic as unknown as { rpcProvider: Eip1193Provider }).rpcProvider,
      );
      const signer = await provider.getSigner();
      return signer.signMessage(message);
    },
    [magic],
  );

  const logout = useCallback(async () => {
    if (magic) await magic.user.logout();
    setAddress(null);
    setEmail(null);
    localStorage.removeItem("user");
    localStorage.removeItem("user_email");
  }, [magic]);

  const value = useMemo(
    () => ({
      magic,
      address,
      email,
      isLoggedIn: !!address,
      restoring,
      googleEnabled: !!GOOGLE_CLIENT_ID,
      loginWithEmailOTP,
      loginWithGoogle,
      signMessage,
      logout,
    }),
    [magic, address, email, restoring, loginWithEmailOTP, loginWithGoogle, signMessage, logout],
  );

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
};
