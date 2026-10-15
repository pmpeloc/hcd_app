'use client';

import dynamic from 'next/dynamic';
import type { IDetectedBarcode, IScannerError, ScannerErrorKind } from '@yudiel/react-qr-scanner';
import { CameraOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// The scanner touches `navigator` on load, so it only renders in the browser.
const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then((m) => m.Scanner), { ssr: false });

// The library defaults to a 640 px minimum height, which rejects common 480p laptop webcams.
// Ideal-only sizes let any camera start and still prefer a sharp feed.
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

const CAMERA_ERRORS: Partial<Record<ScannerErrorKind, string>> = {
  'permission-denied': 'No tenemos permiso para usar la cámara. Habilitalo en el navegador o ingresá el código a mano.',
  'no-camera': 'No encontramos una cámara en este equipo. Ingresá el código a mano.',
  'in-use': 'Otra app está usando la cámara. Cerrala y probá de nuevo.',
  overconstrained: 'Esta cámara no se pudo configurar. Ingresá el código a mano.',
  'insecure-context': 'La cámara solo funciona con una conexión segura (https).',
  unsupported: 'Este navegador no puede leer códigos QR. Ingresá el código a mano.',
};

type CameraViewProps = {
  paused: boolean;
  error: ScannerErrorKind | null;
  onScan: (raw: string) => void;
  onError: (kind: ScannerErrorKind) => void;
  onRetry: () => void;
  className?: string;
};

function Finder({ active }: { active: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="relative size-[min(236px,62%)] lg:size-[276px]">
        <svg viewBox="0 0 250 250" className="absolute inset-0 size-full">
          <path
            d="M4 56V24a20 20 0 0 1 20-20h32M194 4h32a20 20 0 0 1 20 20v32M246 194v32a20 20 0 0 1-20 20h-32M56 246H24a20 20 0 0 1-20-20v-32"
            fill="none"
            stroke="#9fd8f7"
            strokeWidth={6}
            strokeLinecap="round"
          />
        </svg>
        {active && (
          <span className="absolute inset-5 motion-safe:animate-scan-line">
            <span className="block h-[3px] rounded-full bg-linear-to-r from-salua-turquoise to-salua-blue" />
          </span>
        )}
      </div>
    </div>
  );
}

export function CameraView({ paused, error, onScan, onError, onRetry, className }: CameraViewProps) {
  const handleScan = (codes: IDetectedBarcode[]) => {
    const raw = codes[0]?.rawValue;
    if (raw) onScan(raw);
  };
  const handleError = (e: IScannerError) => onError(e.kind);

  return (
    <div
      role="region"
      aria-label="Cámara"
      className={cn(
        'relative overflow-hidden bg-[radial-gradient(120%_90%_at_50%_30%,#2a4468,#0d2950_70%)]',
        className,
      )}
    >
      {error ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="flex max-w-xs flex-col items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-white/10 text-salua-navy-accent">
              <CameraOff aria-hidden="true" className="size-6" />
            </span>
            <p className="text-[15px] leading-normal text-white">{CAMERA_ERRORS[error] ?? 'No pudimos abrir la cámara.'}</p>
            <Button variant="white" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Probar de nuevo
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Scanner
            onScan={handleScan}
            onError={handleError}
            paused={paused}
            formats={['qr_code']}
            sound={false}
            components={{ finder: false, torch: false, onOff: false, zoom: false }}
            constraints={CAMERA_CONSTRAINTS}
            styles={{
              container: { position: 'absolute', inset: 0, width: '100%', height: '100%', paddingTop: 0 },
              video: { width: '100%', height: '100%', objectFit: 'cover' },
            }}
          />
          <Finder active={!paused} />
          <p className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <span className="rounded-full bg-salua-navy/75 px-3.5 py-1.5 text-[13px] text-white backdrop-blur-sm">
              {paused ? 'QR leído' : 'Apuntá al QR que te muestra el paciente'}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
