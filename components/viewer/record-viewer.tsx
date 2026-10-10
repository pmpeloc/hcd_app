'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, KeyRound, Lock, RefreshCw, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useShellIdentity } from '@/components/app-shell/session-shell';
import { formatCloses, formatRemaining, grantProgress } from '@/components/access/access-source';
import { BigNumber } from '@/components/big-number';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip } from '@/components/status-chip';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { originLabel } from '@/components/patient-studies/studies-source';
import { getSupabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { DocumentCanvas } from './document-canvas';
import { openRecord, OpenError, type DocKind, type OpenErrorReason, type OpenPhase } from './open-record';
import { DEMO_RECORDS_ENABLED, depsFor, getViewerRecord, isDemoRecord, type ViewerRecord } from './viewer-source';

type ViewState =
  | { phase: 'loading' }
  | { phase: 'opening'; step: OpenPhase }
  | { phase: 'ok'; bytes: ArrayBuffer; kind: DocKind; hash: string }
  | { phase: 'altered'; expected: string; actual: string }
  | { phase: 'expired' }
  | { phase: 'error'; reason: OpenErrorReason };

const STEPS: { id: OpenPhase; label: string }[] = [
  { id: 'key', label: 'Pidiendo la llave' },
  { id: 'download', label: 'Descargando el archivo cifrado' },
  { id: 'verify', label: 'Verificando la huella' },
  { id: 'decrypt', label: 'Descifrando en tu navegador' },
];

const ERRORS: Record<OpenErrorReason, { title: string; body: string; retry: boolean }> = {
  'no-access': {
    title: 'No tenés acceso a este estudio',
    body: 'El paciente no te dio permiso, o el estudio quedó en disputa o anulado.',
    retry: false,
  },
  session: { title: 'Tu sesión venció', body: 'Volvé a iniciar sesión para abrir el estudio.', retry: false },
  'not-found': { title: 'No encontramos este estudio', body: 'Revisá el enlace o abrilo desde Mis accesos.', retry: false },
  unavailable: {
    title: 'No pudimos completar el acceso',
    body: 'La llave o el archivo no respondieron (el enlace de descarga también vence rápido). Probá de nuevo: pedimos uno nuevo.',
    retry: true,
  },
  corrupt: {
    title: 'No se pudo descifrar',
    body: 'El archivo es el original, pero la llave no lo abre. Avisale a la clínica que lo cargó.',
    retry: false,
  },
  failed: { title: 'No pudimos abrir el estudio', body: 'Revisá tu conexión y probá de nuevo.', retry: true },
};

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-8)}`;

/** The reader's license for the watermark: from `doctors` when signed in, sample data in demo mode. */
function useDoctorLicense(demo: boolean): string | undefined {
  const [license, setLicense] = useState<string>();
  useEffect(() => {
    if (demo) return;
    let active = true;
    (async () => {
      try {
        const client = getSupabaseClient();
        const { data: auth } = await client.auth.getUser();
        if (!auth.user) return;
        const { data } = await client.from('doctors').select('license_number').eq('user_id', auth.user.id).maybeSingle();
        if (active && data?.license_number) setLicense(`Mat. ${data.license_number}`);
      } catch {
        // Without the license the watermark still carries the name and the time.
      }
    })();
    return () => {
      active = false;
    };
  }, [demo]);
  return demo ? 'MN 112.345' : license;
}

export function RecordViewer({ recordId }: { recordId: string }) {
  const identity = useShellIdentity();
  const demo = identity.demo || DEMO_RECORDS_ENABLED;
  const license = useDoctorLicense(identity.demo);
  const [record, setRecord] = useState<ViewerRecord | null>(null);
  const [state, setState] = useState<ViewState>({ phase: 'loading' });
  const [now, setNow] = useState(() => Date.now());
  const [openedAt, setOpenedAt] = useState(() => Date.now());

  // Generation counter: a stale open (e.g. /visor/A resolving after the user
  // navigated to /visor/B) must never paint record A under record B.
  const generation = useRef(0);

  const open = useCallback(async () => {
    const gen = ++generation.current;
    const alive = () => generation.current === gen;
    setState({ phase: 'loading' });
    setOpenedAt(Date.now());
    const meta = await getViewerRecord(recordId, demo).catch(() => null);
    if (!alive()) return;
    setRecord(meta);
    if (meta?.grant && meta.grant.expiresAt <= Date.now()) {
      setState({ phase: 'expired' });
      return;
    }
    try {
      const result = await openRecord(recordId, depsFor(recordId, meta, demo), (step) => {
        if (alive()) setState({ phase: 'opening', step });
      });
      if (!alive()) return;
      setState(result.status === 'ok' ? { phase: 'ok', ...result } : { phase: 'altered', expected: result.expected, actual: result.actual });
    } catch (err) {
      if (!alive()) return;
      const reason = err instanceof OpenError ? err.reason : 'failed';
      setState(reason === 'no-access' && meta?.grant && meta.grant.expiresAt <= Date.now() ? { phase: 'expired' } : { phase: 'error', reason });
    }
  }, [recordId, demo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void open();
  }, [open]);

  // When the grant runs out the decrypted document is dropped from memory and the screen.
  const expiresAt = record?.grant?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= expiresAt) setState((s) => (s.phase === 'expired' ? s : { phase: 'expired' }));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const watermark = useMemo(
    () => [identity.name, license, stamp(openedAt)].filter(Boolean).join(' · '),
    [identity.name, license, openedAt],
  );

  const title = record?.studyName ?? 'Estudio';
  const patientFirst = record?.patient.name.split(' ')[0] ?? 'el paciente';
  const requestHref = record ? `/solicitar?paciente=${record.patient.code}` : '/escanear';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/mis-accesos" className="text-primary">
              Mis accesos
            </Link>
            {record && <> / {record.patient.name}</>}
          </p>
          <h1 className="mt-1.5 text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">{title}</h1>
        </div>
        <StatusChip status="copy" label="Solo lectura · sin descarga" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-5 lg:grid-cols-12 lg:gap-4">
        <section
          aria-label="Documento"
          className="relative min-h-80 overflow-hidden rounded-[22px] border border-border bg-[#eef3f8] p-3 lg:col-span-8 lg:rounded-3xl"
        >
          <p aria-live="polite" className="sr-only">
            {state.phase === 'altered' ? 'Estudio alterado. No se descifró.' : state.phase === 'ok' ? 'Estudio verificado y abierto.' : ''}
          </p>

          {(state.phase === 'loading' || state.phase === 'opening') && (
            <ol aria-label="Abriendo el estudio" className="mx-auto flex max-w-sm flex-col gap-3 py-16">
              {STEPS.map((step, i) => {
                const current = state.phase === 'opening' ? STEPS.findIndex((s) => s.id === state.step) : -1;
                const done = i < current;
                return (
                  <li
                    key={step.id}
                    aria-current={i === current ? 'step' : undefined}
                    className={cn('flex items-center gap-3 text-sm', i <= current ? 'text-salua-navy' : 'text-muted-foreground')}
                  >
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full',
                        done ? 'bg-salua-turquoise text-white' : i === current ? 'bg-white text-primary' : 'bg-white/60',
                      )}
                    >
                      {done ? <Check aria-hidden="true" className="size-4" /> : i === current ? <KeyRound aria-hidden="true" className="size-3.5 motion-safe:animate-pulse" /> : null}
                    </span>
                    <span className={cn(i === current && 'font-semibold')}>{step.label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {state.phase === 'ok' && <DocumentCanvas bytes={state.bytes} kind={state.kind} title={title} watermark={watermark} />}

          {state.phase === 'altered' && (
            <Blocked icon={<ShieldAlert />} tone="error" title="Estudio alterado">
              <p>No lo desciframos: el archivo no coincide con la huella que firmó el emisor. No lo uses para decidir y avisale a la clínica.</p>
              <dl className="mt-4 grid gap-1 text-left font-mono text-xs">
                <div className="flex justify-between gap-3">
                  <dt>Firmada</dt>
                  <dd>{shortHash(state.expected)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Recibida</dt>
                  <dd>{shortHash(state.actual)}</dd>
                </div>
              </dl>
            </Blocked>
          )}

          {state.phase === 'expired' && (
            <Blocked icon={<Clock />} title="Tu permiso venció">
              <p>Para volver a ver la historia de {patientFirst}, pedile un acceso nuevo.</p>
              <Button asChild className="mt-4">
                <Link href={requestHref}>
                  <Send aria-hidden="true" />
                  Pedir acceso
                </Link>
              </Button>
            </Blocked>
          )}

          {state.phase === 'error' && (
            <Blocked icon={<Lock />} tone={state.reason === 'corrupt' ? 'error' : 'mute'} title={ERRORS[state.reason].title}>
              <p>{ERRORS[state.reason].body}</p>
              {ERRORS[state.reason].retry ? (
                <Button onClick={() => void open()} className="mt-4">
                  <RefreshCw aria-hidden="true" />
                  Reintentar
                </Button>
              ) : state.reason === 'no-access' ? (
                <Button asChild className="mt-4">
                  <Link href={requestHref}>
                    <Send aria-hidden="true" />
                    Pedir acceso
                  </Link>
                </Button>
              ) : state.reason === 'session' ? (
                <Button asChild className="mt-4">
                  <Link href="/login">Iniciar sesión</Link>
                </Button>
              ) : null}
            </Blocked>
          )}
        </section>

        <div className="flex flex-col gap-2.5 lg:col-span-4 lg:gap-4">
          {record?.grant && <GrantTile grant={record.grant} now={now} expired={state.phase === 'expired'} patientFirst={patientFirst} />}
          <IntegrityTile state={state} />
          {record && (
            <Tile aria-label="Origen">
              <h2 className="font-sans text-[15px] font-semibold tracking-normal">Origen</h2>
              <dl className="mt-1.5">
                {[
                  [record.origin.type === 'issued' ? 'Emitido por' : 'Copia digitalizada por', record.origin.by],
                  ['Firmó', record.signedBy],
                  ['Cargado', stamp(record.uploadedAt).replace(/\/\d{4} /, ' · ')],
                ].map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-3 border-b border-salua-mute-soft py-2.5 text-sm last:border-b-0">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="text-right font-semibold text-salua-navy">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="sr-only">{originLabel(record.origin)}</p>
            </Tile>
          )}
          {!(isDemoRecord(recordId) && demo) && !record && (
            <p className="px-1 text-[13px] text-muted-foreground">Los datos del emisor y del permiso todavía no están disponibles para este estudio.</p>
          )}
        </div>
      </div>
    </>
  );
}

function Blocked({
  icon,
  title,
  tone = 'mute',
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone?: 'mute' | 'error';
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-80 place-items-center p-4">
      <div role={tone === 'error' ? 'alert' : undefined} className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-tile">
        <span
          aria-hidden="true"
          className={cn(
            'mx-auto grid size-[52px] place-items-center rounded-full [&_svg]:size-6',
            tone === 'error' ? 'bg-salua-error-soft text-salua-error-ink' : 'bg-salua-mute-soft text-salua-ink-muted',
          )}
        >
          {icon}
        </span>
        <h2 className={cn('mt-3.5 text-2xl', tone === 'error' && 'text-salua-error-ink')}>{title}</h2>
        <div className="mt-2 text-sm leading-normal text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function GrantTile({
  grant,
  now,
  expired,
  patientFirst,
}: {
  grant: NonNullable<ViewerRecord['grant']>;
  now: number;
  expired: boolean;
  patientFirst: string;
}) {
  const left = formatRemaining(expired ? 0 : grant.expiresAt - now);
  const total = formatRemaining(grant.expiresAt - grant.grantedAt);
  return (
    <Tile tone={expired ? 'white' : 'mint'} aria-label="Tiempo restante" className={cn(expired && 'border-border bg-salua-mute-soft shadow-none')}>
      <h2 className="font-sans text-[15px] font-semibold tracking-normal">{expired ? 'Permiso vencido' : 'Te quedan'}</h2>
      <BigNumber value={left.value} unit={left.unit} animate={false} className={cn('mt-4 text-[88px] lg:text-[104px]', expired && 'text-salua-ink-muted')} />
      <ProgressTrack value={expired ? 0 : grantProgress(grant, now)} live className="mt-4" />
      <p className={cn('mt-2.5 text-[13px]', expired ? 'text-salua-ink-muted' : 'text-salua-mint-ink')}>
        {expired
          ? `Se cerró ${formatCloses(grant.expiresAt, now)}.`
          : `${patientFirst} te dio ${total.value} ${total.unit}. Se cierra ${formatCloses(grant.expiresAt, now)}.`}
      </p>
    </Tile>
  );
}

function IntegrityTile({ state }: { state: ViewState }) {
  if (state.phase === 'altered') {
    return (
      <Tile aria-label="Integridad del estudio" className="border-[#f1c9d0] bg-salua-error-soft shadow-none">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-salua-error-ink">
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <h2 className="text-base text-salua-error-ink">Estudio alterado</h2>
            <p className="mt-1 text-[13px] leading-normal text-salua-error-ink">Este archivo cambió después de firmarse.</p>
          </div>
        </div>
      </Tile>
    );
  }
  const verified = state.phase === 'ok';
  return (
    <Tile aria-label="Integridad del estudio" className="shadow-none">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full',
            verified ? 'bg-salua-ok-soft text-salua-turquoise-ink' : 'bg-salua-mute-soft text-salua-ink-muted',
          )}
        >
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className={cn('text-base', verified ? 'text-salua-turquoise-ink' : 'text-salua-navy')}>
            {verified ? 'Es el archivo original' : 'Integridad sin verificar'}
          </h2>
          <p className={cn('mt-1 text-[13px] leading-normal', verified ? 'text-salua-turquoise-ink' : 'text-muted-foreground')}>
            {verified
              ? `Coincide con lo que firmó el emisor al cargarlo (${shortHash(state.hash)}).`
              : 'Se comprueba la huella antes de descifrar.'}
          </p>
        </div>
      </div>
    </Tile>
  );
}
