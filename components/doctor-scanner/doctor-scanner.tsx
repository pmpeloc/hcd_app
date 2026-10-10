'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { ScannerErrorKind } from '@yudiel/react-qr-scanner';
import { ScanLine, Search, Send, Upload, UserRound } from 'lucide-react';
import { Switch } from 'radix-ui';
import { BigNumber } from '@/components/big-number';
import { IconWell } from '@/components/icon-well';
import { formatClock, normalizeCode, QR_TTL_SECONDS, secondsUntil } from '@/components/patient-qr/qr-session';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip } from '@/components/status-chip';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShellIdentity } from '@/components/app-shell/session-shell';
import { createApiClient } from '@/lib/api-client';
import { DEMO_DATA } from '@/lib/demo';
import { CameraView } from './camera-view';
import { lookupPatient, type CodeInput, type LookupResult } from './patient-lookup';

const LOW_SECONDS = 30;

const PROBLEMS = {
  expired: {
    title: 'El código venció',
    body: 'Pedile al paciente que genere uno nuevo en Mi QR.',
  },
  'not-found': {
    title: 'No encontramos ese código',
    body: 'Revisá que esté bien escrito o pedile al paciente uno nuevo.',
  },
  invalid: {
    title: 'Ese QR no es de Salua',
    body: 'Pedile al paciente que abra Mi QR en la app.',
  },
} as const;

export function DoctorScanner() {
  const { demo } = useShellIdentity();
  const [result, setResult] = useState<LookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [dniVerified, setDniVerified] = useState(false);
  const [cameraError, setCameraError] = useState<ScannerErrorKind | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [typed, setTyped] = useState('');
  const [inputError, setInputError] = useState('');
  const [left, setLeft] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const requestId = useRef(0);
  const inputId = useId();
  const errorId = useId();

  const found = result?.status === 'found' ? result : null;
  const expiresAt = found?.expiresAt;

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(secondsUntil(expiresAt));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  // A code that runs out while the doctor is still on screen becomes expired.
  const timedOut = Boolean(found) && left === 0;
  const shown: LookupResult | null = found && timedOut ? { status: 'expired', code: found.code } : result;


  const check = async (input: CodeInput) => {
    const id = ++requestId.current;
    setLooking(true);
    setDniVerified(false);
    setResult(null);
    setAnnouncement('Buscando al paciente…');
    const next = await lookupPatient(input, demo || DEMO_DATA ? undefined : createApiClient());
    if (id !== requestId.current) return;
    setLooking(false);
    setResult(next);
    setAnnouncement(
      next.status === 'found'
        ? `Paciente: ${next.patient.name}. Verificá su DNI en persona.`
        : PROBLEMS[next.status].title,
    );
  };

  const onScan = (raw: string) => {
    if (looking || result) return;
    void check({ kind: 'qr', raw });
  };

  const onSubmitCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!typed.trim()) {
      setInputError('Escribí el código que ve el paciente en Mi QR.');
      return;
    }
    if (!normalizeCode(typed)) {
      setInputError('Revisá el código: tiene 4 letras o números, como SAL-4F7K.');
      return;
    }
    setInputError('');
    void check({ kind: 'typed', value: typed });
  };

  const reset = () => {
    requestId.current++;
    setResult(null);
    setLooking(false);
    setDniVerified(false);
    setTyped('');
    setInputError('');
    setAnnouncement('Listo para escanear otro código.');
  };

  const retryCamera = () => {
    setCameraError(null);
    setCameraKey((k) => k + 1);
  };

  const low = Boolean(found) && left > 0 && left <= LOW_SECONDS;
  const query = found ? `?paciente=${encodeURIComponent(found.code)}` : '';

  return (
    <div className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-[22px] lg:grid-cols-12 lg:gap-4">
      <p aria-live="polite" className="sr-only">
        {timedOut ? 'El código venció. Pedile al paciente uno nuevo.' : announcement}
      </p>

      <Tile tone="navy" className="flex flex-col p-0 lg:col-span-7 lg:row-span-2 lg:p-0">
        <CameraView
          key={cameraKey}
          paused={looking || Boolean(result)}
          error={cameraError}
          onScan={onScan}
          onError={setCameraError}
          onRetry={retryCamera}
          className="h-[300px] lg:h-auto lg:min-h-[380px] lg:flex-1"
        />
        <form onSubmit={onSubmitCode} noValidate className="flex flex-col gap-2 p-4 lg:p-[22px]">
          <label htmlFor={inputId} className="text-[13px] font-semibold text-salua-navy-ink">
            ¿No se puede escanear? Ingresá el código
          </label>
          <div className="flex gap-2.5">
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="SAL-4F7K"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={12}
              aria-invalid={Boolean(inputError)}
              aria-describedby={inputError ? errorId : undefined}
              className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-white/35 bg-white/8 px-[18px] font-heading text-base font-semibold tracking-[0.12em] text-white uppercase placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-salua-navy-ink/70 placeholder:normal-case focus-visible:border-white focus-visible:outline-none aria-invalid:border-[#f1a7b2]"
            />
            <Button type="submit" variant="white" disabled={looking} className="h-12">
              <Search aria-hidden="true" />
              Buscar
            </Button>
          </div>
          {inputError && (
            <p id={errorId} className="text-[13px] text-[#f6c3cb]">
              {inputError}
            </p>
          )}
        </form>
      </Tile>

      <Tile className="flex min-h-[260px] flex-col lg:col-span-5">
        {looking ? (
          <div className="flex flex-1 flex-col" aria-busy="true">
            <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">Paciente</h2>
            <div className="mt-5 h-11 w-3/4 rounded-xl bg-salua-mute-soft motion-safe:animate-pulse lg:h-[52px]" />
            <div className="mt-2.5 h-11 w-1/2 rounded-xl bg-salua-mute-soft motion-safe:animate-pulse lg:h-[52px]" />
            <p className="mt-4 text-sm text-muted-foreground">Buscando al paciente…</p>
          </div>
        ) : shown?.status === 'found' ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">Paciente</h2>
              <StatusChip status="valid" label="Código válido" />
            </div>
            <p className="mt-3.5 font-heading text-[34px] leading-none font-semibold tracking-[-0.035em] text-salua-navy lg:mt-4 lg:text-[52px] lg:leading-[0.95] lg:tracking-[-0.04em]">
              {shown.patient.name}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground lg:mt-2.5 lg:text-sm">
              {shown.code} · Paciente desde {shown.patient.since} · {shown.patient.studyCount} estudios
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-salua-warn-soft px-4 py-3.5 lg:mt-[18px]">
              <label htmlFor="dni-verified" className="flex-1 text-sm leading-[1.45] text-[#6b4600]">
                <strong>Verifiqué el DNI en persona</strong>
                <span className="block text-[13px]">Comparalo con el nombre de arriba antes de seguir.</span>
              </label>
              <Switch.Root
                id="dni-verified"
                checked={dniVerified}
                onCheckedChange={setDniVerified}
                className="relative h-8 w-14 shrink-0 cursor-pointer rounded-full bg-[#c9d2de] transition-colors duration-200 ease-out-soft data-[state=checked]:bg-salua-turquoise-ink"
              >
                <Switch.Thumb className="block size-[26px] translate-x-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(13,41,80,0.25)] transition-transform duration-200 ease-out-soft data-[state=checked]:translate-x-[27px]" />
              </Switch.Root>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 lg:mt-auto lg:grid-cols-1 lg:pt-[18px] bento:grid-cols-2">
              {dniVerified ? (
                <>
                  <Button asChild>
                    <Link href={`/cargar${query}`}>
                      <Upload aria-hidden="true" />
                      Cargar estudio
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/solicitar${query}`}>
                      <Send aria-hidden="true" />
                      Pedir acceso
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled>
                    <Upload aria-hidden="true" />
                    Cargar estudio
                  </Button>
                  <Button disabled variant="outline">
                    <Send aria-hidden="true" />
                    Pedir acceso
                  </Button>
                </>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="mt-2 self-center">
              <ScanLine aria-hidden="true" />
              Escanear otro paciente
            </Button>
          </div>
        ) : shown ? (
          <div className="flex flex-1 flex-col items-start">
            <div className="flex w-full items-center justify-between gap-3">
              <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">Paciente</h2>
              <StatusChip status={shown.status === 'expired' ? 'expired' : 'altered'} label={shown.status === 'expired' ? 'Vencido' : 'No válido'} />
            </div>
            <p className="mt-4 font-heading text-2xl leading-tight font-semibold tracking-[-0.02em] text-salua-navy lg:text-[30px]">
              {PROBLEMS[shown.status].title}
            </p>
            <p className="mt-2 text-sm leading-normal text-muted-foreground">{PROBLEMS[shown.status].body}</p>
            {'code' in shown && <p className="mt-1 text-[13px] text-muted-foreground">Código: {shown.code}</p>}
            <Button onClick={reset} className="mt-5 lg:mt-auto">
              <ScanLine aria-hidden="true" />
              Escanear de nuevo
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-start justify-center gap-3 py-2">
            <IconWell size={52}>
              <UserRound />
            </IconWell>
            <p className="font-heading text-xl font-semibold tracking-[-0.02em] text-salua-navy lg:text-2xl">
              Esperando el QR del paciente
            </p>
            <p className="max-w-sm text-sm leading-normal text-muted-foreground">
              Cuando lo leas vas a ver su nombre acá, para confirmarlo con su DNI.
            </p>
          </div>
        )}
      </Tile>

      <Tile tone="sky" className="lg:col-span-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">
              {found && !timedOut ? 'El código vence en' : 'Cada código dura'}
            </h2>
            <p className="mt-1 text-[13px] text-salua-sky-ink">
              {found && !timedOut ? 'Seguí antes de que venza.' : 'Sirve para una sola consulta.'}
            </p>
          </div>
          <BigNumber
            animate={false}
            value={found && !timedOut ? formatClock(left) : formatClock(QR_TTL_SECONDS)}
            className={cn(
              'text-[56px] transition-colors duration-300 lg:text-[72px]',
              !(found && !timedOut) && 'text-salua-navy/25',
              low && 'text-salua-error-ink',
            )}
          />
        </div>
        <ProgressTrack
          live
          tone={low ? 'error' : 'brand'}
          value={found && !timedOut ? left / QR_TTL_SECONDS : 0}
          className="mt-3.5"
        />
      </Tile>
    </div>
  );
}
