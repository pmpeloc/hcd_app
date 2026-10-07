'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, FileText, Lock, RefreshCw, ScanLine, Upload, X } from 'lucide-react';
import { BigNumber } from '@/components/big-number';
import { IconWell } from '@/components/icon-well';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip } from '@/components/status-chip';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ACCEPT_ATTRIBUTE,
  checkFile,
  formatBytes,
  uploadRecord,
  type StudyOrigin,
  type UploadPhase,
  type UploadResult,
} from './upload-record';

type Status = 'editing' | 'running' | 'done' | 'failed';

const PHASES: { id: UploadPhase | 'done'; label: string }[] = [
  { id: 'encrypting', label: 'Cifrando en tu navegador' },
  { id: 'uploading', label: 'Subiendo el archivo cifrado' },
  { id: 'registering', label: 'Registrando la firma' },
  { id: 'done', label: 'Listo' },
];

const STUDY_SUGGESTIONS = [
  'Ecocardiograma Doppler',
  'Electrocardiograma',
  'Hemograma completo',
  'Ecografía abdominal',
  'Radiografía de tórax',
  'Resonancia magnética',
];

const ORIGINS: { id: StudyOrigin; label: string; hint: string }[] = [
  { id: 'issued', label: 'Lo emitimos nosotros', hint: 'Emitido por Clínica del Sol' },
  { id: 'digitized', label: 'Copia de otro centro', hint: 'Copia digitalizada por vos' },
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

export function UploadFlow({ patient }: { patient: { name: string; code: string } }) {
  const [studyType, setStudyType] = useState('');
  const [studyDate, setStudyDate] = useState(today);
  const [origin, setOrigin] = useState<StudyOrigin>('issued');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [typeError, setTypeError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>('editing');
  const [phase, setPhase] = useState<UploadPhase>('encrypting');
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { type: useId(), date: useId(), file: useId(), typeErr: useId(), fileErr: useId(), list: useId() };

  const running = status === 'running';

  // Leaving mid-upload would drop the encrypted file and its key.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const pickFile = (next: File | undefined | null) => {
    if (!next) return;
    const problem = checkFile(next);
    setFileError(problem ?? '');
    setFile(problem ? null : next);
    if (fileInput.current) fileInput.current.value = '';
  };

  const start = async () => {
    const missingType = !studyType.trim();
    setTypeError(missingType ? 'Escribí qué estudio es.' : '');
    if (!file) setFileError('Elegí el archivo del estudio.');
    if (missingType || !file) return;

    setStatus('running');
    setPercent(0);
    setAnnouncement('Cifrando el estudio en tu navegador…');
    try {
      const done = await uploadRecord(
        { patientCode: patient.code, studyType: studyType.trim(), studyDate, origin, file },
        (nextPhase, nextPercent) => {
          setPhase(nextPhase);
          setPercent(nextPercent);
        },
      );
      setResult(done);
      setPercent(100);
      setStatus('done');
      setAnnouncement(`Listo. ${patient.name} ya puede ver el estudio en su historia.`);
    } catch {
      setStatus('failed');
      setAnnouncement('No se pudo subir el estudio. Probá de nuevo.');
    }
  };

  const reset = () => {
    setStudyType('');
    setStudyDate(today());
    setOrigin('issued');
    setFile(null);
    setFileError('');
    setTypeError('');
    setStatus('editing');
    setPercent(0);
    setResult(null);
  };

  const phaseIndex = status === 'done' ? 3 : PHASES.findIndex((p) => p.id === phase);
  const locked = status !== 'editing' && status !== 'failed';
  const steps = [
    { label: `Paciente · ${patient.name}`, state: 'done' },
    { label: 'Tipo y fecha', state: studyType.trim() ? 'done' : 'now' },
    { label: 'Archivo', state: file ? 'done' : studyType.trim() ? 'now' : 'todo' },
    { label: 'Confirmar', state: status === 'done' ? 'done' : file && studyType.trim() ? 'now' : 'todo' },
  ];

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ol aria-label="Pasos" className="mt-3.5 flex flex-wrap gap-2">
        {steps.map((step, i) => (
          <li
            key={step.label}
            aria-current={step.state === 'now' ? 'step' : undefined}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full border pr-4 pl-1.5 text-sm font-semibold transition-colors duration-200',
              step.state !== 'now' && 'max-sm:pr-1.5',
              step.state === 'done' && 'border-border bg-card text-salua-navy',
              step.state === 'now' && 'border-salua-sky-line bg-salua-sky text-primary',
              step.state === 'todo' && 'border-border bg-card text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full text-[13px]',
                step.state === 'done' && 'bg-salua-turquoise-ink text-white',
                step.state === 'now' && 'bg-primary text-white',
                step.state === 'todo' && 'bg-salua-mute-soft text-muted-foreground',
              )}
            >
              {step.state === 'done' ? <Check aria-hidden="true" className="size-3.5 stroke-3" /> : i + 1}
            </span>
            <span className={cn(step.state !== 'now' && 'max-sm:sr-only')}>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-5 lg:grid-cols-12 lg:gap-4">
        <Tile className="flex flex-col gap-4 lg:col-span-7">
          <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">Datos del estudio</h2>

          <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 bento:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.type} className="text-[13px] font-semibold text-salua-navy">
                Tipo de estudio
              </label>
              <input
                id={ids.type}
                list={ids.list}
                value={studyType}
                onChange={(e) => {
                  setStudyType(e.target.value);
                  if (typeError) setTypeError('');
                }}
                placeholder="Ej.: Ecocardiograma Doppler"
                autoComplete="off"
                aria-invalid={Boolean(typeError)}
                aria-describedby={typeError ? ids.typeErr : undefined}
                className="h-[46px] rounded-xl border-[1.5px] border-input bg-card px-3.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-accent disabled:opacity-60 aria-invalid:border-salua-error-ink"
              />
              <datalist id={ids.list}>
                {STUDY_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              {typeError && (
                <p id={ids.typeErr} className="text-[13px] text-salua-error-ink">
                  {typeError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.date} className="text-[13px] font-semibold text-salua-navy">
                Fecha del estudio
              </label>
              <input
                id={ids.date}
                type="date"
                value={studyDate}
                max={today()}
                onChange={(e) => setStudyDate(e.target.value)}
                className="h-[46px] rounded-xl border-[1.5px] border-input bg-card px-3.5 text-[15px] text-foreground tabular-nums outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-accent disabled:opacity-60"
              />
            </div>

            <div role="radiogroup" aria-label="Origen del estudio" className="grid gap-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1 bento:col-span-2 bento:grid-cols-2">
              {ORIGINS.map((o) => (
                <label
                  key={o.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] px-3.5 py-3 transition-colors duration-200 has-focus-visible:ring-4 has-focus-visible:ring-accent',
                    origin === o.id ? 'border-primary bg-salua-sky' : 'border-input bg-card hover:border-salua-line-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="origin"
                    value={o.id}
                    checked={origin === o.id}
                    onChange={() => setOrigin(o.id)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-salua-navy">{o.label}</span>
                    <span className="block text-[13px] text-muted-foreground">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {file ? (
            <div className="flex items-center gap-3 rounded-[18px] border border-border bg-background px-4 py-3.5">
              <IconWell size={44}>
                <FileText />
              </IconWell>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-salua-navy">{file.name}</p>
                <p className="text-[13px] text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {!locked && (
                <Button variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label={`Quitar ${file.name}`}>
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>
          ) : (
            <label
              htmlFor={ids.file}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files[0]);
              }}
              className={cn(
                'relative flex cursor-pointer flex-col items-center overflow-hidden rounded-[18px] border-[1.5px] border-dashed px-6 py-7 text-center transition-colors duration-200 has-focus-visible:ring-4 has-focus-visible:ring-accent',
                dragging ? 'border-primary bg-salua-sky' : 'border-[#9fc4e6] bg-[#f7fbff] hover:bg-salua-sky',
                fileError && 'border-salua-error-ink',
              )}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-2.5 -right-2.5 h-20 w-30 bg-[radial-gradient(circle,#94d3f7_1.2px,transparent_1.5px)] bg-size-[12px_12px] opacity-70"
              />
              <IconWell size={52} className="relative">
                <Upload />
              </IconWell>
              <span className="relative mt-3 font-heading text-lg font-semibold tracking-[-0.01em] text-salua-navy">
                Arrastrá el archivo o <span className="text-primary underline underline-offset-3">elegilo</span>
              </span>
              <span className="relative mt-1 text-[13px] text-muted-foreground">PDF, JPG, PNG o DICOM · hasta 50 MB</span>
              <input
                id={ids.file}
                ref={fileInput}
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                onChange={(e) => pickFile(e.target.files?.[0])}
                aria-invalid={Boolean(fileError)}
                aria-describedby={fileError ? ids.fileErr : undefined}
                className="sr-only"
              />
            </label>
          )}
          {fileError && (
            <p id={ids.fileErr} className="-mt-2 text-[13px] text-salua-error-ink">
              {fileError}
            </p>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-salua-mint-line bg-salua-mint px-4 py-3.5">
            <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 stroke-[1.75] text-salua-turquoise-ink" />
            <p className="text-sm leading-[1.45] text-salua-mint-ink">
              <strong className="text-salua-navy">Se cifra en tu navegador antes de subirse.</strong> Solo lo abren{' '}
              {patient.name} y quien autorice.
            </p>
          </div>
        </Tile>

        <Tile className="flex flex-col lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">
              {status === 'editing' ? 'Revisá antes de confirmar' : 'Progreso'}
            </h2>
            {status === 'done' && <StatusChip status="verified" label="Cargado" />}
            {status === 'failed' && <StatusChip status="altered" label="No se subió" />}
          </div>

          {status === 'editing' ? (
            <dl className="mt-3 text-sm">
              {[
                ['Paciente', `${patient.name} · ${patient.code}`],
                ['Estudio', studyType.trim() || '—'],
                ['Fecha', studyDate ? studyDate.split('-').reverse().join('/') : '—'],
                ['Origen', ORIGINS.find((o) => o.id === origin)?.hint ?? ''],
                ['Archivo', file ? `${file.name} · ${formatBytes(file.size)}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-salua-mute-soft py-2.5 last:border-b-0">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 truncate text-right font-semibold text-salua-navy">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <BigNumber
                animate={false}
                value={percent}
                unit="%"
                className={cn(
                  'mt-4 text-[88px] lg:text-[120px]',
                  status === 'failed' && 'text-salua-error-ink',
                )}
              />
              <ProgressTrack
                value={percent / 100}
                tone={status === 'failed' ? 'error' : 'brand'}
                className="mt-4 h-3"
              />
              <ul className="mt-3">
                {PHASES.map((p, i) => {
                  const state =
                    status === 'done' || i < phaseIndex ? 'ok' : i === phaseIndex ? (status === 'failed' ? 'fail' : 'run') : 'wait';
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        'grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-salua-mute-soft py-2.5 text-[15px] last:border-b-0',
                        state === 'wait' && 'text-muted-foreground',
                        state === 'run' && 'font-semibold text-primary',
                        state === 'ok' && 'text-salua-navy',
                        state === 'fail' && 'font-semibold text-salua-error-ink',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'grid size-6 place-items-center rounded-full',
                          state === 'wait' && 'border-[1.5px] border-salua-line-strong',
                          state === 'run' && 'border-2 border-primary border-r-transparent motion-safe:animate-spin',
                          state === 'ok' && 'bg-salua-turquoise-ink text-white',
                          state === 'fail' && 'bg-salua-error-ink text-white',
                        )}
                      >
                        {state === 'ok' && <Check className="size-3.5 stroke-3" />}
                        {state === 'fail' && <X className="size-3.5 stroke-3" />}
                      </span>
                      <span>{p.label}</span>
                      <span className="text-[13px] font-medium">
                        {state === 'ok' ? 'Hecho' : state === 'run' ? 'En curso' : state === 'fail' ? 'Falló' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {status === 'done' && result && (
            <p className="mt-3 text-sm leading-normal text-salua-mint-ink">
              {patient.name} ya lo ve en su historia. Huella del archivo{' '}
              <span className="font-semibold text-salua-navy tabular-nums">{shortHash(result.contentHash)}</span>
            </p>
          )}
          {status === 'failed' && (
            <p className="mt-3 text-sm leading-normal text-salua-error-ink">
              No se pudo subir. El archivo no salió de tu equipo sin cifrar. Revisá tu conexión y probá de nuevo.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2.5 lg:mt-auto lg:pt-5">
            {status === 'editing' && (
              <Button size="lg" onClick={start} className="w-full">
                <Upload aria-hidden="true" />
                Confirmar y subir
              </Button>
            )}
            {status === 'running' && (
              <Button size="lg" disabled className="w-full">
                Subiendo…
              </Button>
            )}
            {status === 'failed' && (
              <>
                <Button size="lg" onClick={start} className="w-full">
                  <RefreshCw aria-hidden="true" />
                  Reintentar
                </Button>
                <Button variant="ghost" onClick={() => setStatus('editing')}>
                  Revisar los datos
                </Button>
              </>
            )}
            {status === 'done' && (
              <>
                <Button size="lg" onClick={reset} className="w-full">
                  <Upload aria-hidden="true" />
                  Cargar otro estudio
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link href="/escanear">
                    <ScanLine aria-hidden="true" />
                    Escanear otro paciente
                  </Link>
                </Button>
              </>
            )}
          </div>
        </Tile>
      </div>
    </>
  );
}
