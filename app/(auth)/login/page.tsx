'use client';

import { useState, type FormEvent } from 'react';
import { AuthProviders, useSaluaWallet } from '@/lib/auth-providers';
import { useSession } from '@/lib/session-provider';
import { getSupabaseClient } from '@/lib/supabase';

function LoginContent() {
  const { session, loading, error: sessionError } = useSession();
  const wallet = useSaluaWallet();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await getSupabaseClient().auth.signInWithOtp({ email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/login` } });
      if (error) throw error;
      setMessage('Check your email for a sign-in link. Open it in this browser.');
    } catch { setError('Could not send the sign-in link. Check your email and try again.'); }
    finally { setBusy(false); }
  }
  async function googleLogin() {
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({ provider: 'google',
        options: { redirectTo: `${window.location.origin}/login` } });
      if (error) throw error;
    } catch { setError('Google sign-in is unavailable. Please try email instead.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError(''); setMessage('');
    try {
      // Clear the wallet session first, then the Supabase session. Both are attempted.
      let walletFailed = false;
      try { await wallet.logout(); } catch { walletFailed = true; }
      const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
      if (error || walletFailed) throw new Error('Sign-out incomplete');
    } catch { setError('Could not fully sign out. Please retry.'); }
    finally { setBusy(false); }
  }
  const button = 'w-full rounded-xl px-4 py-3 font-medium transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-salua-blue';
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-salua-navy">
    <section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-sm" aria-labelledby="login-title">
      <p className="mb-8 text-2xl font-bold tracking-tight">Salua<span className="text-salua-turquoise">.</span></p>
      <h1 id="login-title" className="text-2xl font-semibold">{session ? 'Your account' : 'Your health story, with you.'}</h1>
      <p className="mt-3 mb-7 text-sm leading-6 text-slate-600">{session ? 'You are signed in.' : 'Sign in to get started with Salua.'}</p>
      {loading ? <p role="status">Restoring your session…</p> : session ? <div className="space-y-5">
        <p className="break-all text-sm">{session.user.email}</p>
        <div className="rounded-xl bg-slate-50 p-4">
          <h2 className="font-medium">Your Solana wallet</h2>
          {wallet.address ? <p className="mt-2 break-all text-sm" aria-label="Wallet address">{wallet.address}</p>
            : wallet.error ? <><p role="alert" className="mt-2 text-sm text-red-700">{wallet.error}</p><button className="mt-3 underline" onClick={wallet.retry}>Retry wallet setup</button></>
              : <p role="status" className="mt-2 text-sm">Preparing your wallet…</p>}
        </div>
        <button className={`${button} border border-salua-navy`} onClick={() => void signOut()} disabled={busy}>Sign out</button>
      </div> : <div className="space-y-5">
        <button className={`${button} border border-slate-300`} onClick={() => void googleLogin()} disabled={busy || !!sessionError}>Continue with Google</button>
        <p className="text-center text-sm text-slate-500">or use your email</p>
        <form className="space-y-3" onSubmit={emailLogin}>
          <label htmlFor="email" className="block text-sm font-medium">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" disabled={busy} />
          <button className={`${button} bg-salua-blue text-white`} disabled={busy || !!sessionError}>{busy ? 'Please wait…' : 'Send sign-in link'}</button>
        </form>
      </div>}
      {(error || sessionError) && <p role="alert" className="mt-5 text-sm text-red-700">{error || sessionError}</p>}
      {message && <p role="status" className="mt-5 text-sm text-salua-navy">{message}</p>}
    </section>
  </main>;
}

export default function LoginPage() {
  return <AuthProviders><LoginContent /></AuthProviders>;
}
