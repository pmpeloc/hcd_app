'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PrivyProvider, usePrivy, useSyncJwtBasedAuthState } from '@privy-io/react-auth';
import { useCreateWallet, useWallets } from '@privy-io/react-auth/solana';
import { SessionProvider, useSession } from './session-provider';
import { getSupabaseClient } from './supabase';
import { embeddedSolanaAddress, matchesSession, PRIVY_APP_ID } from './privy';

type WalletState = { address?: string; error?: string; busy: boolean; retry: () => void; logout: () => Promise<void> };
const WalletContext = createContext<WalletState>({ busy: false, retry: () => {}, logout: async () => {} });
export const useSaluaWallet = () => useContext(WalletContext);

function WalletBridge({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const { user, authenticated, logout } = usePrivy();
  const { ready } = useWallets();
  const { createWallet } = useCreateWallet();
  const [creationError, setCreationError] = useState<string>();
  const [createdAddress, setCreatedAddress] = useState<string>();
  const attempted = useRef(false);
  const inFlight = useRef(false);
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
  const error = session && state.status === 'error'
    ? 'Could not connect your wallet session. Sign out and try again.'
    : session && state.status === 'not-enabled'
      ? 'Wallet sign-in is not enabled. Contact the Salua team.' : creationError;
  return <WalletContext.Provider value={{ address, error, busy: !!session && !address && !error,
    retry: () => { void ensureWallet(); }, logout }}>
    {children}
  </WalletContext.Provider>;
}

function WalletProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!PRIVY_APP_ID) return <WalletContext.Provider value={{ busy: false, error: 'Wallet service is not configured.', retry: () => {}, logout: async () => {} }}>{children}</WalletContext.Provider>;
  return <PrivyProvider key={session?.user.id ?? 'signed-out'} appId={PRIVY_APP_ID}
    config={{ embeddedWallets: { solana: { createOnLogin: 'off' }, ethereum: { createOnLogin: 'off' } } }}>
    <WalletBridge>{children}</WalletBridge>
  </PrivyProvider>;
}

export function AuthProviders({ children }: { children: ReactNode }) {
  return <SessionProvider><WalletProvider>{children}</WalletProvider></SessionProvider>;
}
