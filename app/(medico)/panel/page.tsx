import Link from 'next/link';
import { connection } from 'next/server';
import { ShellFirstName } from '@/components/app-shell/session-shell';
import { PanelTiles } from '@/components/doctor/panel-tiles';
import { ProviderActivation } from '@/components/doctor/provider-activation';
import { ScanLine, Upload } from 'lucide-react';
import { Tile } from '@/components/tile';
import { Button } from '@/components/ui/button';

const DOCTOR = { clinic: 'Clínica del Sol' };

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('es-AR', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE }).format(now));
  if (hour < 12) return 'Buen día';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function longDate(now: Date) {
  const text = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1).replace(',', '');
}

export default async function DoctorHomePage() {
  await connection();
  const now = new Date();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">
            {greeting(now)}, médico <ShellFirstName />
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {longDate(now)} · {DOCTOR.clinic}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="outline">
            <Link href="/cargar">
              <Upload aria-hidden="true" className="stroke-[1.75]" />
              Cargar estudio
            </Link>
          </Button>
          <Button asChild>
            <Link href="/escanear">
              <ScanLine aria-hidden="true" className="stroke-[1.75]" />
              Escanear QR
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-flow-row-dense lg:grid-cols-12">
        <ProviderActivation />
        <PanelTiles />
      </div>
    </>
  );
}
