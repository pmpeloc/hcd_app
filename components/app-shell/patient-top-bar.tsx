import Link from 'next/link';
import { QrCode, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PatientTopBar() {
  return (
    <>
      <label className="flex h-11 flex-[0_1_380px] items-center gap-2.5 rounded-full bg-background px-4 text-muted-foreground">
        <Search aria-hidden="true" className="size-[18px] stroke-[1.75]" />
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Buscar estudio, médico o centro"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <Button asChild>
        <Link href="/qr">
          <QrCode aria-hidden="true" className="stroke-[1.75]" />
          Mostrar mi QR
        </Link>
      </Button>
    </>
  );
}
