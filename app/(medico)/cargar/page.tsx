import Link from 'next/link';
import { ScanLine } from 'lucide-react';
import { normalizeCode } from '@/components/patient-qr/qr-session';
import { UploadFlow } from '@/components/doctor-upload/upload-flow';
import { IconWell } from '@/components/icon-well';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';

// Placeholder until the scanner hands over a real patient from the API.
const PLACEHOLDER_PATIENT_NAME = 'Ana Martínez';

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const { paciente } = await searchParams;
  const code = paciente ? normalizeCode(paciente) : null;

  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Cargar estudio</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        El archivo se cifra en tu navegador antes de subirse.
      </p>

      {code ? (
        <UploadFlow patient={{ name: PLACEHOLDER_PATIENT_NAME, code }} />
      ) : (
        <Tile tone="sky" className="mt-5 flex max-w-xl flex-col items-start gap-3 lg:mt-6">
          <IconWell size={52} className="bg-white">
            <ScanLine />
          </IconWell>
          <h2 className="text-xl lg:text-2xl">Primero identificá al paciente</h2>
          <p className="text-sm leading-normal text-salua-sky-ink">
            Escaneá su QR y verificá su DNI en persona. Después volvés acá para cargar el estudio.
          </p>
          <Button asChild className="mt-1">
            <Link href="/escanear">
              <ScanLine aria-hidden="true" />
              Escanear QR
            </Link>
          </Button>
        </Tile>
      )}
    </>
  );
}
