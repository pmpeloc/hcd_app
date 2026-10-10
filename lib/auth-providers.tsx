'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PrivyProvider, usePrivy, useSyncJwtBasedAuthState } from '@privy-io/react-auth';
import { useCreateWallet, useSignMessage, useSignTransaction, useWallets } from '@privy-io/react-auth/solana';
import { SessionProvider, useSession } from './session-provider';
import { getSupabaseClient } from './supabase';
import { embeddedSolanaAddress, matchesSession, PRIVY_APP_ID } from './privy';
import { enrollWallet } from './enrollment';
import { sessionToken, SessionError } from './api-client';

type WalletState = {
  address?: string;
  error?: string;
  busy: boolean;
  /** Wallet enrollment with the API: the wallet proves possession by signing a challenge. */
  enrolled: boolean;
  enrolling: boolean;
  /** Signs a base64 transaction with the enrolled wallet; throws when none is ready. */
  signTx: (txBase64: string) => Promise<string>;
  retry: () => void;
  logout: () => Promise<void>;
};
const WalletContext = createContext<WalletState>({
  busy: false,
  enrolled: false,
  enrolling: false,
  signTx: () => Promise.reject(new Error('no wallet')),
  retry: () => {},
  logout: async () => {},
});
export const useSaluaWallet = () => useContext(WalletContext);

function WalletBridge({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const { user, authenticated, logout } = usePrivy();
  const { ready, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signMessage } = useSignMessage();
  const { signTransaction } = useSignTransaction();
  const [creationError, setCreationError] = useState<string>();
  const [createdAddress, setCreatedAddress] = useState<string>();
  const [enrolled, setEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string>();
  const attempted = useRef(false);
  const inFlight = useRef(false);
  const enrollInFlight = useRef<string | undefined>(undefined);
  const subscribe = useCallback((notify: () => void) => {
    const { data } = getSupabaseClient().auth.onAuthStateChange(() => notify());
    return () => data.subscription.unsubscribe();
  }, []);
  const getExternalJwt = useCallback(async () => {
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      return error ? undefined : data.session?.access_token;
    } catch { return undefined; }
  }, []);
  const { state } = useSyncJwtBasedAuthState({ subscribe, getExternalJwt, enabled: !loading });
  const synced = !!session && authenticated && state.status === 'done' && matchesSession(user, session.user.id);
  const address = synced ? embeddedSolanaAddress(user) ?? createdAddress : undefined;
  const ensureWallet = useCallback(async () => {
    if (!synced || !ready || address || inFlight.current) return;
    inFlight.current = true;
    attempted.current = true;
    setCreationError(undefined);
    try {
      const result = await createWallet();
      setCreatedAddress(result.wallet.address);
    } catch {
      setCreationError('Could not prepare your wallet. Please try again.');
    } finally { inFlight.current = false; }
  }, [synced, ready, address, createWallet]);
  useEffect(() => {
    if (!attempted.current) void ensureWallet();
  }, [ensureWallet]);

  // Enrollment binds the wallet to the account server-side. The challenge is
  // requested automatically; the signature is always the user's explicit
  // action inside Privy's modal. Runs once per address per session.
  const enroll = useCallback(async (walletAddress: string) => {
    if (enrollInFlight.current === walletAddress) return;
    const wallet = wallets.find((w) => w.address === walletAddress);
    if (!wallet) return; // useWallets not hydrated yet; effect retries.
    enrollInFlight.current = walletAddress;
    setEnrolling(true);
    setEnrollError(undefined);
    try {
      const token = await sessionToken();
      await enrollWallet(token, walletAddress, async (message) => {
        const { signature } = await signMessage({ message, wallet });
        return signature;
      });
      setEnrolled(true);
    } catch (err) {
      setEnrollError(
        err instanceof SessionError
          ? 'Your session expired. Sign in again to link your wallet.'
          : 'Could not link your wallet. Try again.',
      );
    } finally {
      setEnrolling(false);
      enrollInFlight.current = undefined;
    }
  }, [wallets, signMessage]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (address && !enrolled && !enrollError) void enroll(address);
  }, [address, enrolled, enrollError, enroll]);

  // The one signer the app's tx flows share: the enrolled embedded wallet
  // signs the API-built bytes inside Privy's modal.
  const signTx = useCallback(async (txBase64: string) => {
    const wallet = wallets.find((w) => w.address === address);
    if (!wallet || !address) throw new Error('no wallet');
    const binary = atob(txBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const { signedTransaction } = await signTransaction({ transaction: bytes, wallet });
    let out = '';
    for (const b of signedTransaction) out += String.fromCharCode(b);
    return btoa(out);
  }, [wallets, address, signTransaction]);

  const error = session && state.status === 'error'
    ? 'Could not connect your wallet session. Sign out and try again.'
    : session && state.status === 'not-enabled'
      ? 'Wallet sign-in is not enabled. Contact the Salua team.'
      : (creationError ?? enrollError);
  return <WalletContext.Provider value={{
    address,
    error,
    busy: !!session && !address && !error,
    enrolled,
    enrolling,
    signTx,
    retry: () => {
      if (address) void enroll(address);
      else void ensureWallet();
    },
    logout,
  }}>
    {children}
  </WalletContext.Provider>;
}

function WalletProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!PRIVY_APP_ID) return <WalletContext.Provider value={{ busy: false, enrolled: false, enrolling: false, signTx: () => Promise.reject(new Error('no wallet')), error: 'Wallet service is not configured.', retry: () => {}, logout: async () => {} }}>{children}</WalletContext.Provider>;
  return <PrivyProvider key={session?.user.id ?? 'signed-out'} appId={PRIVY_APP_ID}
    config={{ embeddedWallets: { solana: { createOnLogin: 'off' }, ethereum: { createOnLogin: 'off' } } }}>
    <WalletBridge>{children}</WalletBridge>
  </PrivyProvider>;
}

export function AuthProviders({ children }: { children: ReactNode }) {
  return <SessionProvider><WalletProvider>{children}</WalletProvider></SessionProvider>;
}
