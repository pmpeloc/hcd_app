'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, IdCard, RefreshCw } from 'lucide-react';
import { BigNumber } from '@/components/big-number';
import { IconWell } from '@/components/icon-well';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip } from '@/components/status-chip';
import { Tile, TileCross } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QrCode } from './qr-code';
import { QR_TTL_SECONDS, createQrSession, encodeQrPayload, shortAccount, type QrSession } from './qr-session';

const LOW_SECONDS = 30;

type Phase = 'loading' | 'ready' | 'error';

function secondsUntil(expiresAt: number) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PatientQr({ patientName }: { patientName: string }) {
  const [session, setSession] = useState<QrSession | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [left, setLeft] = useState(QR_TTL_SECONDS);
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const requestId = useRef(0);

  const issue = useCallback(async () => {
    const id = ++requestId.current;
    setPhase('loading');
    try {
      const next = await createQrSession();
      if (id !== requestId.current) return;
      setSession(next);
      setLeft(secondsUntil(next.expiresAt));
      setPhase('ready');
      setAnnouncement(`Código nuevo: ${next.code}. Vence en 2 minutos.`);
    } catch {
      if (id !== requestId.current) return;
      setPhase('error');
      setAnnouncement('No pudimos generar el código.');
    }
  }, []);

  useEffect(() => {
    // Initial issue on mount; state updates happen after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void issue();
  }, [issue]);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const next = secondsUntil(session.expiresAt);
      setLeft(next);
      if (next === 0) {
        setAnnouncement('El código venció. Generá uno nuevo.');
        window.clearInterval(timer);
      }
    };
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const loading = phase === 'loading';
  const expired = phase === 'ready' && left === 0;
  const low = phase === 'ready' && left > 0 && left <= LOW_SECONDS;
  const usable = phase === 'ready' && !expired;

  const copyAccount = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.account);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the short form stays visible either way.
    }
  };

  const note = expired
    ? 'Generá uno nuevo para tu consulta.'
    : low
      ? 'Quedan pocos segundos.'
      : 'Mostráselo al médico. Sirve para una sola consulta.';

  return (
    <div className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-[22px] lg:grid-cols-12 lg:gap-4">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Tile className="p-5 lg:col-span-6 lg:row-span-2 lg:flex lg:flex-col bento:col-span-5">
        <div className="relative flex items-center justify-between gap-3">
          <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">{patientName}</h2>
          {phase === 'ready' && (expired ? <StatusChip status="expired" /> : <StatusChip status="valid" label="Válido" />)}
        </div>

        <div className="relative mx-auto mt-4 w-full max-w-[232px] lg:my-auto lg:max-w-[300px] lg:pt-4">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-3.5 rounded-[26px] bg-[radial-gradient(circle,#94d3f7_1.2px,transparent_1.5px)] bg-size-[11px_11px] opacity-70 lg:top-0.5"
          />
          <div className="relative aspect-square rounded-[18px] border border-border bg-white p-2.5 text-salua-navy">
            <div
              className={cn(
                'size-full transition-[filter,opacity] duration-300 ease-out-soft',
                (expired || loading) && 'opacity-35 blur-[5px]',
                phase === 'error' && 'opacity-20 blur-[5px]',
              )}
            >
              {session ? (
                <QrCode value={encodeQrPayload(session)} label={`Código QR de un solo uso de ${patientName}`} />
              ) : (
                <div aria-hidden="true" className="size-full rounded-xl bg-salua-mute-soft motion-safe:animate-pulse" />
              )}
            </div>
          </div>

          {expired && (
            <div className="absolute inset-0 grid place-items-center lg:pt-4">
              <Button onClick={issue} className="h-11 px-5 shadow-tile">
                <RefreshCw aria-hidden="true" />
                Generar uno nuevo
              </Button>
            </div>
          )}
        </div>

        <p
          className={cn(
            'relative mt-3.5 text-center font-heading text-2xl font-semibold tracking-[0.12em] text-salua-navy lg:mt-5 lg:text-[28px]',
            !usable && 'text-muted-foreground line-through decoration-2',
            loading && 'no-underline',
          )}
        >
          {session?.code ?? 'SAL-····'}
        </p>
        <p className="relative mt-0.5 text-center text-[13px] text-muted-foreground">
          Si no lo pueden escanear, dictá el código.
        </p>

        {session && (
          <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-salua-mute-soft pt-3.5 lg:mt-5">
            <p className="min-w-0 text-[13px] text-muted-foreground">
              Tu cuenta <span className="font-semibold text-salua-navy tabular-nums">{shortAccount(session.account)}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAccount}
              aria-label={copied ? 'Identificador copiado' : 'Copiar el identificador de tu cuenta'}
              className="h-9 shrink-0 px-3 text-[13px]"
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        )}
      </Tile>

      <Tile tone="sky" className="lg:col-span-6 lg:flex lg:flex-col bento:col-span-7">
        {phase === 'error' ? (
          <div className="flex flex-col items-start gap-3 lg:my-auto">
            <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">No pudimos generar el código</h2>
            <p className="text-[13px] text-salua-sky-ink">Revisá tu conexión y probá de nuevo.</p>
            <Button onClick={issue}>
              <RefreshCw aria-hidden="true" />
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3 lg:block">
              <div>
                <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">
                  {expired ? 'Venció' : 'Vence en'}
                </h2>
                <p className="mt-1 text-[13px] text-salua-sky-ink">{note}</p>
              </div>
              <BigNumber
                animate={false}
                value={loading ? '–:––' : formatClock(left)}
                className={cn(
                  'text-[64px] transition-colors duration-300 lg:mt-6 lg:text-[132px]',
                  (low || expired) && 'text-salua-error-ink',
                  loading && 'text-salua-navy/30',
                )}
              />
            </div>
            <ProgressTrack
              live
              tone={low || expired ? 'error' : 'brand'}
              value={loading ? 0 : left / QR_TTL_SECONDS}
              className="mt-3.5 lg:mt-6"
            />
            {!expired && (
              <Button
                variant="outline"
                onClick={issue}
                disabled={loading}
                className="mt-4 h-11 w-full lg:mt-auto lg:w-auto lg:self-start"
              >
                <RefreshCw aria-hidden="true" className={cn(loading && 'motion-safe:animate-spin')} />
                {loading ? 'Generando…' : 'Generar uno nuevo'}
              </Button>
            )}
          </>
        )}
      </Tile>

      <Tile tone="mint" className="flex items-start gap-3 lg:col-span-6 lg:items-center lg:gap-4 bento:col-span-7">
        <TileCross className="hidden lg:block" />
        <IconWell tone="teal" size={40} className="relative bg-white lg:size-12">
          <IdCard />
        </IconWell>
        <div className="relative">
          <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">Tené tu DNI a mano</h2>
          <p className="mt-0.5 text-[13px] leading-[1.45] text-salua-mint-ink lg:text-sm">
            El médico lo verifica en persona. El código no muestra ningún dato médico.
          </p>
        </div>
      </Tile>
    </div>
  );
}
