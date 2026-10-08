'use client';

import { createContext, useContext } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { LogIn } from 'lucide-react';
import { SaluaLogo } from '@/components/salua-logo';
import { Button } from '@/components/ui/button';
import { AuthProviders } from '@/lib/auth-providers';
import { useSession } from '@/lib/session-provider';
import { AppShell, type ShellNote } from './app-shell';
import type { NavBadges, ShellRole } from './navigation';

export type ShellIdentity = {
  name: string;
  subtitle: string;
  /** True when auth is not configured on this machine and the screens run on sample data. */
  demo: boolean;
};

const IdentityContext = createContext<ShellIdentity | null>(null);

/** Who is signed in, as shown in the shell. Only available inside a SessionShell. */
export function useShellIdentity(): ShellIdentity {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error('useShellIdentity must be used inside SessionShell');
  return identity;
}

// NEXT_PUBLIC_* values are inlined at build time.
const AUTH_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Mounts the Supabase + Privy providers only when auth is configured. Without
 * Supabase config the wallet bridge throws, so demo mode skips it entirely.
 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  return AUTH_CONFIGURED ? <AuthProviders>{children}</AuthProviders> : <>{children}</>;
}

function displayName(user: User): string {
  const meta = user.user_metadata ?? {};
  const fromProvider = [meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  if (fromProvider) return fromProvider.trim();
  const local = user.email?.split('@')[0] ?? 'Tu cuenta';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

const COPY: Record<ShellRole, { subtitle: string; gate: string }> = {
  patient: { subtitle: 'Paciente', gate: 'Iniciá sesión para ver tu historia clínica.' },
  doctor: { subtitle: 'Profesional de la salud', gate: 'Iniciá sesión para atender a tus pacientes.' },
};

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-5">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-tile">
        <SaluaLogo withWordmark className="justify-center" />
        {children}
      </div>
    </main>
  );
}

type SessionShellProps = {
  role: ShellRole;
  /** Shown only in demo mode, when auth is not configured. */
  demoUser: { name: string; subtitle: string };
  note?: ShellNote;
  badges?: NavBadges;
  unreadNotifications?: number;
  topBar?: React.ReactNode;
  children: React.ReactNode;
};

export function SessionShell({ role, demoUser, children, ...shell }: SessionShellProps) {
  const { session, loading, error } = useSession();

  if (!AUTH_CONFIGURED) {
    const identity = { ...demoUser, demo: true };
    return (
      <IdentityContext.Provider value={identity}>
        <AppShell role={role} user={identity} accountHref="/login" {...shell}>
          <p className="mb-4 inline-flex rounded-full bg-salua-warn-soft px-3.5 py-1.5 text-[13px] font-semibold text-salua-warn-ink">
            Modo demo: datos de ejemplo, sin cuenta real.
          </p>
          {children}
        </AppShell>
      </IdentityContext.Provider>
    );
  }

  if (loading) {
    return (
      <CenteredCard>
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Cargando tu sesión…
        </p>
      </CenteredCard>
    );
  }

  if (!session) {
    return (
      <CenteredCard>
        <h1 className="mt-6 text-xl">{COPY[role].gate}</h1>
        {error && (
          <p role="alert" className="mt-2 text-sm text-salua-error-ink">
            No pudimos recuperar tu sesión. Volvé a iniciarla.
          </p>
        )}
        <Button asChild className="mt-5 w-full">
          <Link href="/login">
            <LogIn aria-hidden="true" />
            Iniciar sesión
          </Link>
        </Button>
      </CenteredCard>
    );
  }

  const identity = { name: displayName(session.user), subtitle: COPY[role].subtitle, demo: false };
  return (
    <IdentityContext.Provider value={identity}>
      <AppShell role={role} user={identity} accountHref="/login" {...shell}>
        {children}
      </AppShell>
    </IdentityContext.Provider>
  );
}

/** The signed-in person's first name, for greetings ("Hola, Ana"). Titles like "Dra." are kept. */
export function ShellFirstName() {
  const { name } = useShellIdentity();
  const parts = name.split(/\s+/);
  const titled = /^(dra?|lic)\.?$/i.test(parts[0] ?? '');
  return <>{titled ? parts.slice(0, 2).join(' ') : parts[0]}</>;
}
