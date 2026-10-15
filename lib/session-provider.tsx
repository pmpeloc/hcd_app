'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

interface SessionState { session: Session | null; loading: boolean; error: string | null }
const SessionContext = createContext<SessionState>({ session: null, loading: true, error: null });
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      const client = getSupabaseClient();
      // INITIAL_SESSION and subsequent changes share one ordered subscription.
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        if (active) setState({ session, loading: false, error: null });
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void client.auth.getSession().then(({ error }) => {
        if (active && error) setState({ session: null, loading: false, error: 'Could not restore your session. Please sign in again.' });
      }).catch(() => {
        if (active) setState({ session: null, loading: false, error: 'Sign-in is temporarily unavailable.' });
      });
    } catch {
      queueMicrotask(() => { if (active) setState({ session: null, loading: false, error: 'Sign-in is not configured. Contact the Salua team.' }); });
    }
    return () => { active = false; unsubscribe(); };
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

