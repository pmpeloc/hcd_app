'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import { BigNumber } from '@/components/big-number';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ACCESS_DURATIONS, DurationSelector, type AccessDurationId } from '@/components/duration-selector';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip } from '@/components/status-chip';
import { Tile, TileCross, TileDots } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { useShellIdentity } from '@/components/app-shell/session-shell';
import { useSaluaWallet } from '@/lib/auth-providers';
import { createApiClient } from '@/lib/api-client';
import { DEMO_DATA } from '@/lib/demo';
import {
  approveRequest,
  effectiveStatus,
  expiryFor,
  formatAgo,
  formatCloses,
  formatRemaining,
  FULL_HISTORY,
  getMyAccess,
  grantProgress,
  rejectRequest,
  revokeGrant,
  type AccessRequest,
  type Grant,
  type MyAccess,
} from './access-source';

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; access: MyAccess };

/** Re-renders every 30 s so remaining times stay honest without ticking every second. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const formatDay = (t: number) => {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function AccessCenter() {
  const { demo } = useShellIdentity();
  const offline = demo || DEMO_DATA;
  const wallet = useSaluaWallet();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [announcement, setAnnouncement] = useState('');
  const [revoking, setRevoking] = useState<Grant | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState('');
  const now = useNow();

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'ready', access: await getMyAccess(offline ? undefined : createApiClient()) });
    } catch {
      setState({ phase: 'error' });
    }
  }, [offline]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const update = (fn: (access: MyAccess) => MyAccess) =>
    setState((prev) => (prev.phase === 'ready' ? { phase: 'ready', access: fn(prev.access) } : prev));

  const onApproved = (request: AccessRequest, grant: Grant) => {
    update((a) => ({
      requests: a.requests.filter((r) => r.id !== request.id),
      // A resumed approval already has a (partial) grant card: replace it.
      grants: [grant, ...a.grants.filter((g) => g.id !== grant.id)],
    }));
    const { value, unit } = formatRemaining(grant.expiresAt - grant.grantedAt);
    setAnnouncement(`Aprobaste ${value} ${unit} a ${request.doctor.name}. Se cierra ${formatCloses(grant.expiresAt, Date.now())}.`);
  };

  const onRejected = (request: AccessRequest) => {
    update((a) => ({ ...a, requests: a.requests.filter((r) => r.id !== request.id) }));
    setAnnouncement(`Rechazaste la solicitud de ${request.doctor.name}.`);
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    setRevokeError('');
    try {
      await revokeGrant(
        revoking,
        offline ? undefined : { post: createApiClient().post, sign: wallet.signTx },
        offline ? undefined : wallet.address,
      );
      const closedAt = Date.now();
      update((a) => ({
        ...a,
        grants: a.grants.map((g) => (g.id === revoking.id ? { ...g, status: 'revoked', expiresAt: closedAt } : g)),
      }));
      setAnnouncement(`${revoking.doctor.name} ya no puede ver tus estudios.`);
      setRevoking(null);
    } catch {
      setRevokeError('No pudimos revocarlo. Probá de nuevo.');
    } finally {
      setRevokeBusy(false);
    }
  };

  if (state.phase === 'loading') {
    return (
      <div aria-busy="true" aria-label="Cargando tus accesos" className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-[22px] lg:grid-cols-12 lg:gap-4">
        <div className="h-56 rounded-[22px] bg-salua-mute-soft motion-safe:animate-pulse lg:col-span-5 lg:rounded-3xl" />
        <div className="h-56 rounded-[22px] bg-salua-mute-soft motion-safe:animate-pulse lg:col-span-7 lg:rounded-3xl" />
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <Tile className="mt-4 flex max-w-xl flex-col items-start gap-3 lg:mt-[22px]">
        <p className="font-heading text-lg font-semibold text-salua-navy">No pudimos traer tus accesos</p>
        <p className="text-sm text-muted-foreground">Revisá tu conexión y probá de nuevo.</p>
        <Button onClick={load}>
          <RefreshCw aria-hidden="true" />
          Reintentar
        </Button>
      </Tile>
    );
  }

  const { requests, grants } = state.access;
  const active = grants.filter((g) => effectiveStatus(g, now) === 'active');
  const past = grants.filter((g) => effectiveStatus(g, now) !== 'active');

  return (
    <div className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-[22px] lg:grid-cols-12 lg:gap-4">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <h2 className="mt-1 text-base lg:col-span-12 lg:text-lg">
        Para decidir
        {requests.length > 0 && <span className="ml-2 font-sans text-sm font-semibold text-muted-foreground tabular-nums">{requests.length}</span>}
      </h2>

      {requests.length === 0 ? (
        <Tile className="lg:col-span-12 bento:col-span-7">
          <p className="font-heading text-lg font-semibold text-salua-navy">No tenés solicitudes pendientes</p>
          <p className="mt-1 max-w-md text-sm leading-normal text-muted-foreground">
            Cuando un médico te pida acceso, lo vas a ver acá. Si no respondés, la respuesta es no.
          </p>
        </Tile>
      ) : (
        requests.map((request) => (
          <RequestDecision key={request.id} request={request} now={now} offline={offline} onApproved={onApproved} onRejected={onRejected} />
        ))
      )}

      <h2 className="mt-3 text-base lg:col-span-12 lg:mt-4 lg:text-lg">Pueden ver tus estudios</h2>

      {active.length === 0 ? (
        <Tile tone="mint" className="lg:col-span-6 bento:col-span-4">
          <TileCross />
          <p className="relative font-heading text-lg font-semibold text-salua-navy">Nadie puede verlos ahora</p>
          <p className="relative mt-1 text-sm leading-normal text-salua-mint-ink">
            Tus estudios están cifrados. Solo se abren cuando aprobás una solicitud.
          </p>
        </Tile>
      ) : (
        active.map((grant) => {
          const { value, unit } = formatRemaining(grant.expiresAt - now);
          return (
            <Tile key={grant.id} tone="mint" aria-label={`Permiso de ${grant.doctor.name}`} className="lg:col-span-6 bento:col-span-4">
              <TileCross />
              <div className="relative">
                <h3 className="font-sans text-[15px] font-semibold tracking-normal">{grant.doctor.name}</h3>
                <p className="mt-0.5 text-[13px] text-salua-mint-ink">
                  {grant.doctor.specialty} · {grant.scope}
                </p>
              </div>
              <BigNumber value={value} unit={unit} className="relative mt-5 text-[76px] lg:mt-[22px] lg:text-[96px]" />
              <p className="sr-only">
                Le quedan {value} {unit}.
              </p>
              <ProgressTrack value={grantProgress(grant, now)} className="relative mt-3.5 lg:mt-[18px]" />
              <div className="relative mt-2.5 flex items-center justify-between gap-2">
                <p className="text-[13px] text-salua-mint-ink">Se cierra solo {formatCloses(grant.expiresAt, now)}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRevokeError('');
                    setRevoking(grant);
                  }}
                  className="-mr-2 h-8 px-3 text-[13px] text-salua-error-ink hover:bg-salua-error-soft"
                >
                  Revocar
                </Button>
              </div>
            </Tile>
          );
        })
      )}

      <Tile tone="sky" className="flex flex-col justify-between gap-4 lg:col-span-6 bento:col-span-4">
        <div>
          <h3 className="font-sans text-[15px] font-semibold tracking-normal">Vos decidís</h3>
          <p className="mt-1 text-sm leading-normal text-salua-sky-ink">
            Cada permiso se cierra solo al vencer y queda registrado en Solana. Podés revocarlo antes en cualquier momento.
          </p>
        </div>
        <Button asChild variant="outline" className="self-start">
          <Link href="/qr">
            <QrCode aria-hidden="true" />
            Mostrar mi QR
          </Link>
        </Button>
      </Tile>

      {past.length > 0 && (
        <Tile aria-label="Permisos anteriores" className="lg:col-span-12 bento:col-span-8">
          <h2 className="text-base lg:px-2 lg:text-lg">Permisos anteriores</h2>
          <ul className="mt-1.5">
            {past.map((grant) => {
              const status = effectiveStatus(grant, now);
              return (
                <li
                  key={grant.id}
                  className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-salua-mute-soft py-3 last:border-b-0 lg:px-2"
                >
                  <UserAvatar name={grant.doctor.name} tone="soft" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-salua-navy">{grant.doctor.name}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {grant.scope} · hasta el <span className="tabular-nums">{formatDay(grant.expiresAt)}</span>
                    </p>
                  </div>
                  <StatusChip status={status === 'revoked' ? 'revoked' : 'expired'} />
                </li>
              );
            })}
          </ul>
        </Tile>
      )}

      <ConfirmDialog
        open={revoking !== null}
        onCancel={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
        title="¿Revocar este permiso?"
        confirmLabel="Sí, revocar"
        busyLabel="Revocando…"
        busy={revokeBusy}
        error={revokeError}
      >
        {revoking && (
          <p className="rounded-xl bg-background px-3.5 py-2.5">
            <span className="block font-semibold text-salua-navy">{revoking.doctor.name}</span>
            {revoking.scope} · se cerraba {formatCloses(revoking.expiresAt, now)}
          </p>
        )}
        <p className="mt-3">Deja de poder abrir tus estudios en este momento. Si lo necesita, te puede pedir acceso de nuevo.</p>
      </ConfirmDialog>
    </div>
  );
}

type RequestDecisionProps = {
  request: AccessRequest;
  now: number;
  offline: boolean;
  onApproved: (request: AccessRequest, grant: Grant) => void;
  onRejected: (request: AccessRequest) => void;
};

function RequestDecision({ request, now, offline, onApproved, onRejected }: RequestDecisionProps) {
  const wallet = useSaluaWallet();
  const [duration, setDuration] = useState<AccessDurationId>('24h');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState('');
  const chosen = ACCESS_DURATIONS.find((d) => d.id === duration) ?? ACCESS_DURATIONS[1];
  const { doctor } = request;

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(action);
    setError('');
    try {
      const api = offline ? undefined : createApiClient();
      if (action === 'approve')
        onApproved(request, await approveRequest(request, duration, api ? { post: api.post, sign: wallet.signTx } : undefined));
      else {
        await rejectRequest(request.id, api);
        onRejected(request);
      }
    } catch {
      setError(action === 'approve' ? 'No pudimos aprobarla. Probá de nuevo.' : 'No pudimos rechazarla. Probá de nuevo.');
      setBusy(null);
    }
  };

  return (
    <>
      <Tile tone="navy" aria-label={`Solicitud de ${doctor.name}`} className="flex flex-col lg:col-span-5">
        <TileDots />
        <StatusChip status="pending" label="Solicitud pendiente" className="relative self-start" />
        <div className="relative mt-3.5 flex items-center gap-3">
          <UserAvatar name={doctor.name} size={48} className="bg-white text-[15px] text-salua-navy" />
          <div className="min-w-0">
            <h3 className="font-heading text-xl leading-[1.15] font-semibold tracking-[-0.02em] text-white">{doctor.name}</h3>
            <p className="mt-0.5 text-[13px] text-salua-navy-ink">
              {doctor.specialty} · {doctor.license} · {request.clinic}
            </p>
          </div>
        </div>
        <p className="relative mt-3 text-sm leading-[1.45] text-[#e3ecf7]">
          {request.reason}
        </p>
        <div className="relative mt-auto flex flex-wrap items-center gap-2 pt-4">
          {doctor.verified && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-salua-navy-accent">
              <BadgeCheck aria-hidden="true" className="size-3.5" />
              Matrícula verificada
            </span>
          )}
          <span className="text-xs text-salua-navy-ink">{formatAgo(request.requestedAt, now)}</span>
        </div>
      </Tile>

      <Tile aria-label={`Decidir la solicitud de ${doctor.name}`} className="flex flex-col lg:col-span-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="font-sans text-[15px] font-semibold tracking-normal">¿Por cuánto tiempo?</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Después se cierra solo.</p>
          </div>
          <BigNumber value={chosen.value} unit={chosen.unit} className="text-[64px] lg:text-[76px]" />
        </div>
        <DurationSelector value={duration} onChange={setDuration} disabled={busy !== null} className="mt-4" />
        <dl className="mt-3">
          {[
            ['Puede ver', FULL_HISTORY],
            ['Puede descargar', 'No'],
            ['Se cierra', formatCloses(expiryFor(duration, now), now)],
          ].map(([term, value]) => (
            <div key={term} className="flex justify-between gap-3 border-b border-salua-mute-soft py-2.5 text-sm last:border-b-0">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="text-right font-semibold text-salua-navy">{value}</dd>
            </div>
          ))}
        </dl>
        {error && (
          <p role="alert" className="mt-2 text-sm text-salua-error-ink">
            {error}
          </p>
        )}
        <div className="mt-auto grid grid-cols-[1fr_1.5fr] gap-2.5 pt-4">
          <Button variant="secondary" disabled={busy !== null} onClick={() => void decide('reject')}>
            {busy === 'reject' ? 'Rechazando…' : 'Rechazar'}
          </Button>
          <Button disabled={busy !== null} onClick={() => void decide('approve')}>
            <ShieldCheck aria-hidden="true" />
            {busy === 'approve' ? 'Firmando…' : `Aprobar ${chosen.label}`}
          </Button>
        </div>
      </Tile>
    </>
  );
}
