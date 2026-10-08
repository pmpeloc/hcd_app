'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, FileText, FlaskConical, Image as ImageIcon, QrCode, RefreshCw, type LucideIcon } from 'lucide-react';
import { BigNumber } from '@/components/big-number';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { IconWell } from '@/components/icon-well';
import { StatusChip } from '@/components/status-chip';
import { Tile, TileCross } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  disputeStudy,
  formatStudyDate,
  getMyStudies,
  originLabel,
  type Study,
  type StudyKind,
  type StudyStatus,
} from './studies-source';

const KIND_ICONS: Record<StudyKind, LucideIcon> = {
  lab: FlaskConical,
  imaging: ImageIcon,
  cardio: Activity,
  other: FileText,
};

const STATUS_CHIP = { active: 'active', disputed: 'disputed', voided: 'voided' } as const;

const STATUS_NOTE: Partial<Record<StudyStatus, string>> = {
  disputed: 'Marcaste que no es tuyo. Quien lo emitió lo está revisando.',
  voided: 'Anulado por quien lo emitió. Ya no forma parte de tu historia.',
};

type Filter = 'all' | StudyStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'disputed', label: 'En disputa' },
  { id: 'voided', label: 'Anulados' },
];

const EMPTY_FILTER: Record<Exclude<Filter, 'all'>, string> = {
  active: 'No tenés estudios activos.',
  disputed: 'No tenés estudios en disputa.',
  voided: 'No tenés estudios anulados.',
};

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; studies: Study[] };

export function StudiesList() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [filter, setFilter] = useState<Filter>('all');
  const [disputing, setDisputing] = useState<Study | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'ready', studies: await getMyStudies() });
    } catch {
      setState({ phase: 'error' });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const studies = state.phase === 'ready' ? state.studies : [];
  const count = (status: StudyStatus) => studies.filter((s) => s.status === status).length;
  const visible = filter === 'all' ? studies : studies.filter((s) => s.status === filter);

  const confirmDispute = async () => {
    if (!disputing) return;
    setBusy(true);
    setDialogError('');
    try {
      await disputeStudy(disputing.id);
      setState((prev) =>
        prev.phase === 'ready'
          ? {
              phase: 'ready',
              studies: prev.studies.map((s) => (s.id === disputing.id ? { ...s, status: 'disputed' } : s)),
            }
          : prev,
      );
      setAnnouncement(`${disputing.name} quedó en disputa.`);
      setDisputing(null);
    } catch {
      setDialogError('No pudimos registrarlo. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-[22px] lg:grid-cols-12 lg:gap-4">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Tile className="lg:col-span-12 lg:row-span-2 bento:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 lg:px-2">
          <h2 className="text-base lg:text-lg">Tus estudios</h2>
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const n = f.id === 'all' ? studies.length : count(f.id);
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors duration-200 ease-out-soft',
                    on
                      ? 'border-salua-navy bg-salua-navy text-white'
                      : 'border-border bg-card text-salua-navy hover:border-salua-line-strong',
                  )}
                >
                  {f.label}
                  {state.phase === 'ready' && <span className={cn('tabular-nums', on ? 'text-white/70' : 'text-muted-foreground')}>{n}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {state.phase === 'loading' && (
          <ul aria-busy="true" aria-label="Cargando tus estudios" className="mt-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3.5 border-b border-salua-mute-soft py-3.5 last:border-b-0 lg:px-2">
                <span className="size-11 shrink-0 rounded-full bg-salua-mute-soft motion-safe:animate-pulse" />
                <span className="h-4 w-1/2 rounded-md bg-salua-mute-soft motion-safe:animate-pulse" />
              </li>
            ))}
          </ul>
        )}

        {state.phase === 'error' && (
          <div className="flex flex-col items-start gap-3 py-8 lg:px-2">
            <p className="font-heading text-lg font-semibold text-salua-navy">No pudimos traer tus estudios</p>
            <p className="text-sm text-muted-foreground">Revisá tu conexión y probá de nuevo.</p>
            <Button onClick={load}>
              <RefreshCw aria-hidden="true" />
              Reintentar
            </Button>
          </div>
        )}

        {state.phase === 'ready' && studies.length === 0 && (
          <div className="flex flex-col items-start gap-3 py-8 lg:px-2">
            <p className="font-heading text-lg font-semibold text-salua-navy">Todavía no tenés estudios</p>
            <p className="max-w-md text-sm leading-normal text-muted-foreground">
              Cuando un médico te cargue uno, lo vas a ver acá. Para eso, mostrale tu QR en la consulta.
            </p>
            <Button asChild variant="outline">
              <Link href="/qr">
                <QrCode aria-hidden="true" />
                Mostrar mi QR
              </Link>
            </Button>
          </div>
        )}

        {state.phase === 'ready' && studies.length > 0 && visible.length === 0 && filter !== 'all' && (
          <p className="py-8 text-sm text-muted-foreground lg:px-2">{EMPTY_FILTER[filter]}</p>
        )}

        {state.phase === 'ready' && visible.length > 0 && (
          <ul className="mt-1.5">
            {visible.map((study) => {
              const Icon = KIND_ICONS[study.kind];
              const voided = study.status === 'voided';
              return (
                <li
                  key={study.id}
                  className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-salua-mute-soft py-3.5 last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center lg:gap-x-3.5 lg:rounded-xl lg:px-2"
                >
                  <IconWell size={40} className={cn('sm:size-11', voided && 'opacity-50')}>
                    <Icon />
                  </IconWell>
                  <div className="min-w-0">
                    <p className={cn('text-[15px] font-semibold', voided ? 'text-muted-foreground line-through decoration-1' : 'text-salua-navy')}>
                      {study.name}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      <span className="tabular-nums">{formatStudyDate(study.date)}</span> · {originLabel(study.origin)}
                    </p>
                    {STATUS_NOTE[study.status] && (
                      <p className={cn('mt-1 text-[13px]', study.status === 'disputed' ? 'text-salua-warn-ink' : 'text-muted-foreground')}>
                        {STATUS_NOTE[study.status]}
                      </p>
                    )}
                  </div>
                  <div className="col-start-2 flex items-center gap-2 sm:col-start-3 sm:justify-end">
                    <StatusChip status={STATUS_CHIP[study.status]} />
                    {study.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDialogError('');
                          setDisputing(study);
                        }}
                        className="h-8 px-3 text-[13px] text-salua-error-ink hover:bg-salua-error-soft"
                      >
                        No es mío
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Tile>

      <Tile tone="sky" className="lg:col-span-6 bento:col-span-4">
        <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">En tu historia</h2>
        <BigNumber value={state.phase === 'ready' ? count('active') : '–'} className="mt-3 text-[72px] lg:text-[96px]" />
        <p className="mt-2 text-[13px] text-salua-sky-ink">
          {state.phase === 'ready'
            ? `${count('active') === 1 ? 'estudio activo' : 'estudios activos'} · ${count('disputed')} en disputa · ${count('voided')} anulado${count('voided') === 1 ? '' : 's'}`
            : 'Cargando…'}
        </p>
      </Tile>

      <Tile tone="mint" className="lg:col-span-6 bento:col-span-4">
        <TileCross />
        <h2 className="relative font-sans text-sm font-semibold tracking-normal lg:text-[15px]">¿Un estudio no es tuyo?</h2>
        <p className="relative mt-1.5 text-sm leading-[1.5] text-salua-mint-ink">
          Tocá «No es mío». Queda en disputa y quien lo emitió lo revisa para anularlo. Cada estudio muestra quién lo
          emitió o quién lo digitalizó.
        </p>
      </Tile>

      <ConfirmDialog
        open={disputing !== null}
        onCancel={() => setDisputing(null)}
        onConfirm={() => void confirmDispute()}
        title="¿Este estudio no es tuyo?"
        confirmLabel="Sí, no es mío"
        busyLabel="Registrando…"
        busy={busy}
        error={dialogError}
      >
        {disputing && (
          <p className="rounded-xl bg-background px-3.5 py-2.5">
            <span className="block font-semibold text-salua-navy">{disputing.name}</span>
            {formatStudyDate(disputing.date)} · {originLabel(disputing.origin)}
          </p>
        )}
        <p className="mt-3">Va a quedar «En disputa» y quien lo emitió lo revisa para anularlo.</p>
      </ConfirmDialog>
    </div>
  );
}
