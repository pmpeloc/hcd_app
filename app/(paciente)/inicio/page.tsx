'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronRight, FileText, FlaskConical, Image as ImageIcon, QrCode, type LucideIcon } from 'lucide-react';
import { ShellFirstName } from '@/components/app-shell/session-shell';
import { BigNumber } from '@/components/big-number';
import { IconWell } from '@/components/icon-well';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip } from '@/components/status-chip';
import { Tile, TileCross, TileDots } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { createApiClient } from '@/lib/api-client';
import { useSaluaWallet } from '@/lib/auth-providers';
import { useSession } from '@/lib/session-provider';
import { cn } from '@/lib/utils';
import {
  formatCloses,
  formatRemaining,
  getMyAccess,
  revokeGrant,
  type AccessRequest,
  type Grant,
  type MyAccess,
} from '@/components/access/access-source';
import {
  formatStudyDate,
  getMyStudies,
  originLabel,
  type Study,
  type StudyKind,
} from '@/components/patient-studies/studies-source';
import {
  EVENT_LABEL,
  EVENT_WHO,
  formatEventTime,
  getTimeline,
  type TimelineEvent,
} from '@/components/timeline/timeline-source';

const KIND_ICONS: Record<StudyKind, LucideIcon> = {
  lab: FlaskConical,
  imaging: ImageIcon,
  cardio: Activity,
  other: FileText,
};

const EMPTY_ACCESS: MyAccess = { requests: [], grants: [] };

// Mirrors SessionShell: without Supabase env the shell renders demo data and
// no providers mount, so `useSession` would stay loading forever.
const AUTH_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** The home tile texts once real data is loaded. */
function requestDetail(request: AccessRequest) {
  const parts = [request.doctor.specialty, request.doctor.license, request.clinic].filter(Boolean);
  return parts.join(' · ');
}

function grantProgress(grant: Grant, now: number) {
  const total = grant.expiresAt - grant.grantedAt;
  return total > 0 ? Math.min(1, Math.max(0, (now - grant.grantedAt) / total)) : 1;
}

export default function PatientHomePage() {
  const { session, loading: sessionLoading } = useSession();
  const wallet = useSaluaWallet();
  const [access, setAccess] = useState<MyAccess>(EMPTY_ACCESS);
  const [studies, setStudies] = useState<Study[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(Date.now);

  const load = useCallback(async () => {
    const api = session ? createApiClient() : undefined;
    const deps = api ? { get: api.get } : undefined;
    try {
      const [a, s] = await Promise.all([
        getMyAccess(deps),
        getMyStudies(deps),
      ]);
      setAccess(a);
      setStudies(s);
      setEvents(deps ? await getTimeline(deps) : []);
      setNow(Date.now());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading || !AUTH_CONFIGURED) void load();
  }, [sessionLoading, load]);

  async function revoke(grant: Grant) {
    setRevoking(true);
    try {
      await revokeGrant(
        grant,
        { post: createApiClient().post, sign: wallet.signTx },
        wallet.address,
      );
      await load();
    } catch {
      setLoadError(true);
    } finally {
      setRevoking(false);
    }
  }

  const pendingRequest = access.requests[0];
  const activeGrant =
    access.grants
      .filter((g) => g.status === 'active' && g.expiresAt > now)
      .sort((a, b) => a.expiresAt - b.expiresAt)[0];
  const grantRemaining = activeGrant ? formatRemaining(activeGrant.expiresAt - now) : undefined;

  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">
        Hola, <ShellFirstName />
      </h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        <span className="lg:hidden">Tu historia clínica, bajo tu control.</span>
        <span className="hidden lg:inline">
          {pendingRequest
            ? 'Tenés una solicitud para revisar y un permiso abierto.'
            : 'Tu historia clínica, bajo tu control.'}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:mt-[22px] lg:grid-flow-row-dense lg:grid-cols-12 lg:gap-4">
        {pendingRequest && (
          <Tile tone="navy" className="col-span-2 flex flex-col p-[18px] lg:col-span-6 bento:col-span-5">
            <TileDots />
            <StatusChip status="pending" label="Solicitud pendiente" className="relative self-start" />
            <h2 className="relative mt-2.5 text-lg leading-[1.3] tracking-[-0.01em] text-white lg:mt-3.5 lg:text-2xl lg:leading-[1.2]">
              {pendingRequest.doctor.name} quiere ver tu historia
            </h2>
            <p className="relative mt-1 text-[13px] text-salua-navy-ink lg:mt-1.5 lg:text-sm">
              {requestDetail(pendingRequest)}
              {pendingRequest.doctor.verified ? ' · verificada' : ''}
            </p>
            <Button asChild variant="white" className="relative mt-3.5 h-10 self-start px-4 text-sm lg:mt-auto lg:h-11 lg:px-5 lg:text-[15px]">
              <Link href="/accesos">
                Revisar y decidir
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          </Tile>
        )}

        {activeGrant && grantRemaining && (
          <Tile tone="mint" className="col-span-2 p-[18px] lg:col-span-6 bento:col-span-4">
            <TileCross className="-top-[26px] -right-[26px] w-[130px] lg:-top-[30px] lg:-right-[30px] lg:w-[150px]" />
            <div className="relative flex items-end justify-between gap-3 lg:block">
              <div>
                <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">Permiso activo</h2>
                <p className="mt-1 text-[13px] text-salua-mint-ink">
                  {activeGrant.doctor.name} · {activeGrant.scope}
                </p>
              </div>
              <BigNumber
                value={grantRemaining.value}
                unit={grantRemaining.unit}
                className="text-[76px] lg:mt-[22px] lg:text-[104px]"
              />
            </div>
            <ProgressTrack value={grantProgress(activeGrant, now)} className="relative mt-3.5 lg:mt-[18px]" />
            <div className="relative mt-2 flex items-center justify-between gap-2 lg:mt-2.5">
              <p className="text-xs text-salua-mint-ink lg:text-[13px]">
                Se cierra solo {formatCloses(activeGrant.expiresAt, now)}
              </p>
              <button
                type="button"
                disabled={revoking || !wallet.enrolled}
                onClick={() => void revoke(activeGrant)}
                className="text-[13px] font-semibold text-salua-error-ink underline underline-offset-3 disabled:opacity-50"
              >
                {revoking ? 'Revocando…' : 'Revocar'}
              </button>
            </div>
          </Tile>
        )}

        <Tile asChild className="lg:hidden">
          <Link href="/estudios">
            <h2 className="font-sans text-sm font-semibold tracking-normal">Mis estudios</h2>
            <p className="mt-3.5 font-heading text-[44px] leading-[0.9] font-semibold tracking-[-0.04em] text-salua-navy tabular-nums">
              {studies.length}
            </p>
            {studies[0] && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Último: {formatStudyDate(studies[0].date, 'short')}
              </p>
            )}
          </Link>
        </Tile>

        <Tile asChild tone="sky" className="flex flex-col justify-between lg:col-span-6 lg:min-h-60 bento:col-span-3">
          <Link href="/qr">
            <IconWell size={52} className="size-11 bg-white lg:size-[52px]">
              <QrCode />
            </IconWell>
            <div className="mt-3.5">
              <h2 className="font-sans text-sm font-semibold tracking-normal lg:font-heading lg:text-xl lg:tracking-[-0.02em]">
                Mi QR
              </h2>
              <p className="mt-0.5 text-xs leading-[1.45] text-salua-sky-ink lg:mt-1 lg:text-[13px]">
                <span className="lg:hidden">Para tu próxima consulta</span>
                <span className="hidden lg:inline">Mostralo en la consulta. Vence a los 2 minutos.</span>
              </p>
            </div>
          </Link>
        </Tile>

        <Tile className="col-span-2 lg:col-span-12 bento:col-span-8">
          <div className="flex items-baseline justify-between lg:px-2">
            <h2 className="text-base lg:text-lg">
              <span className="lg:hidden">Últimos estudios</span>
              <span className="hidden lg:inline">Mis estudios</span>
            </h2>
            <Link href="/estudios" className="text-[13px] font-semibold text-primary lg:text-sm">
              <span className="lg:hidden">Ver todos</span>
              <span className="hidden lg:inline">Ver los {studies.length}</span>
            </Link>
          </div>
          {studies.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {ready
                ? loadError
                  ? 'No pudimos cargar tus estudios. Reintentá en un momento.'
                  : 'Todavía no tenés estudios cargados.'
                : 'Cargando tus estudios…'}
            </p>
          ) : (
            <ul className="mt-1 lg:mt-1.5">
              {studies.slice(0, 3).map((study, i) => {
                const Icon = KIND_ICONS[study.kind];
                return (
                  <li
                    key={study.id}
                    className={cn(
                      'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-salua-mute-soft py-3 last:border-b-0 lg:grid-cols-[44px_minmax(0,1fr)_auto] lg:gap-3.5 bento:grid-cols-[44px_minmax(0,1fr)_auto_auto] lg:rounded-xl lg:px-2 lg:py-3.5 lg:transition-colors lg:hover:bg-[#f8fafc]',
                      i === 1 && 'border-b-0 lg:border-b',
                      i >= 2 && 'hidden lg:grid',
                    )}
                  >
                    <IconWell size={40} className="lg:size-11">
                      <Icon />
                    </IconWell>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-salua-navy">{study.name}</p>
                      <p className="text-xs text-muted-foreground lg:text-[13px]">
                        <span className="bento:hidden">{formatStudyDate(study.date, 'short')} · </span>
                        {originLabel(study.origin)}
                      </p>
                    </div>
                    <span className="hidden text-[13px] text-muted-foreground tabular-nums bento:inline">
                      {formatStudyDate(study.date)}
                    </span>
                    <StatusChip
                      status={
                        study.pending
                          ? 'pending'
                          : study.status === 'disputed'
                            ? 'disputed'
                            : study.status === 'voided'
                              ? 'voided'
                              : study.origin.type === 'digitized'
                                ? 'copy'
                                : 'verified'
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Tile>

        <Tile className="hidden lg:col-span-6 lg:block bento:col-span-4">
          <h2 className="text-lg">Registro de accesos</h2>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {ready ? 'Sin actividad todavía.' : 'Cargando…'}
            </p>
          ) : (
            <ol className="mt-4">
              {events.slice(0, 4).map((event) => (
                <li
                  key={event.id}
                  className="relative pb-4 pl-[22px] before:absolute before:top-1.5 before:left-1 before:size-[9px] before:rounded-full before:bg-salua-blue after:absolute after:top-[18px] after:bottom-0.5 after:left-2 after:w-px after:bg-salua-line-strong last:after:hidden"
                >
                  <p className="text-sm font-semibold text-salua-navy">
                    {EVENT_WHO[event.kind] === 'you'
                      ? EVENT_LABEL[event.kind]
                      : `${event.organization ?? event.actorWallet ?? 'Alguien'} ${EVENT_LABEL[event.kind].toLowerCase()}`}
                    {event.recordTitle ? ` · ${event.recordTitle}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatEventTime(event.at)}</p>
                </li>
              ))}
            </ol>
          )}
          <Link href="/linea-de-tiempo" className="text-[13px] font-semibold text-primary">
            Ver comprobante
          </Link>
        </Tile>
      </div>
    </>
  );
}
