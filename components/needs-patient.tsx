import Link from 'next/link';
import { ScanLine } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';

/** Shown on doctor screens opened without a scanned patient. */
export function NeedsPatient({ then }: { then: string }) {
  return (
    <Tile tone="sky" className="mt-5 flex max-w-xl flex-col items-start gap-3 lg:mt-6">
      <IconWell size={52} className="bg-white">
        <ScanLine />
      </IconWell>
      <h2 className="text-xl lg:text-2xl">Primero identificá al paciente</h2>
      <p className="text-sm leading-normal text-salua-sky-ink">
        Escaneá su QR y verificá su DNI en persona. Después volvés acá para {then}.
      </p>
      <Button asChild className="mt-1">
        <Link href="/escanear">
          <ScanLine aria-hidden="true" />
          Escanear QR
        </Link>
      </Button>
    </Tile>
  );
}
