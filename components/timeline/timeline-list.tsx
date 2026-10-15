'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, ExternalLink, Eye, FilePlus2, Flag, QrCode, RefreshCw, ShieldCheck, ShieldOff, type LucideIcon } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { useShellIdentity } from '@/components/app-shell/session-shell';
import { createApiClient } from '@/lib/api-client';
import { DEMO_DATA } from '@/lib/demo';
import {
  EVENT_LABEL,
  EVENT_WHO,
  explorerTxUrl,
  formatEventTime,
  getTimeline,
  type TimelineEvent,
  type TimelineEventKind,
} from './timeline-source';

const KIND_ICON: Record<TimelineEventKind, LucideIcon> = {
  record_issued: FilePlus2,
  record_disputed: Flag,
  record_voided: Ban,
  access_granted: ShieldCheck,
  access_revoked: ShieldOff,
  access_logged: Eye,
};

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; events: TimelineEvent[] };

export function TimelineList() {
  const { demo } = useShellIdentity();
  const offline = demo || DEMO_DATA;
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({
        phase: 'ready',
        // The indexer only mirrors real chain events — demo mode has no
        // trail, so the empty state stands in.
        events: offline ? [] : await getTimeline(createApiClient()),
      });
    } catch {
      setState({ phase: 'error' });
    }
  }, [offline]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.phase === 'loading') {
    return (
      <Tile className="mt-4 lg:mt-[22px]" aria-busy="true" aria-label="Cargando tu historial">
        <ul>
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3.5 border-b border-salua-mute-soft py-3.5 last:border-b-0 lg:px-2">
              <span className="size-11 shrink-0 rounded-full bg-salua-mute-soft motion-safe:animate-pulse" />
              <span className="h-4 w-2/3 rounded-md bg-salua-mute-soft motion-safe:animate-pulse" />
            </li>
          ))}
        </ul>
      </Tile>
    );
  }

  if (state.phase === 'error') {
    return (
      <Tile className="mt-4 flex max-w-xl flex-col items-start gap-3 lg:mt-[22px]">
        <p className="font-heading text-lg font-semibold text-salua-navy">No pudimos traer tu historial</p>
        <p className="text-sm text-muted-foreground">Revisá tu conexión y probá de nuevo.</p>
        <Button onClick={load}>
          <RefreshCw aria-hidden="true" />
          Reintentar
        </Button>
      </Tile>
    );
  }

  const { events } = state;

  if (events.length === 0) {
    return (
      <Tile className="mt-4 flex max-w-xl flex-col items-start gap-3 lg:mt-[22px]">
        <p className="font-heading text-lg font-semibold text-salua-navy">Todavía no hay movimientos</p>
        <p className="max-w-md text-sm leading-normal text-muted-foreground">
          Cada vez que alguien cargue o abra un estudio tuyo queda asentado en Solana y lo vas a ver acá.
        </p>
        <Button asChild variant="outline">
          <Link href="/qr">
            <QrCode aria-hidden="true" />
            Mostrar mi QR
          </Link>
        </Button>
      </Tile>
    );
  }

  return (
    <Tile className="mt-4 lg:mt-[22px]" aria-label="Movimientos sobre tus estudios">
      <ul className="mt-1.5">
        {events.map((event) => {
          const Icon = KIND_ICON[event.kind];
          const who =
            EVENT_WHO[event.kind] === 'you' ? 'Vos' : (event.organization ?? event.actorWallet ?? 'Un profesional');
          return (
            <li
              key={event.id}
              className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-salua-mute-soft py-3.5 last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] lg:gap-x-3.5 lg:px-2"
            >
              <IconWell size={40} className="sm:size-11">
                <Icon />
              </IconWell>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-salua-navy">{EVENT_LABEL[event.kind]}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {event.recordTitle ?? 'Estudio'} · {who}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <p className="text-[13px] text-muted-foreground tabular-nums">{formatEventTime(event.at)}</p>
                {event.txSignature && (
                  <a
                    href={explorerTxUrl(event.txSignature)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ver la transacción del ${formatEventTime(event.at)} en el explorador`}
                    className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-salua-mute-soft hover:text-salua-navy"
                  >
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}
