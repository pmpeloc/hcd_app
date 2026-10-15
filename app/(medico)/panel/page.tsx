import Link from 'next/link';
import { connection } from 'next/server';
import { ShellFirstName } from '@/components/app-shell/session-shell';
import { ScanLine, Upload } from 'lucide-react';
import { BigNumber } from '@/components/big-number';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip, type Status } from '@/components/status-chip';
import { Tile, TileCross, TileDots } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';

const DOCTOR = { clinic: 'Clínica del Sol' };

const NEXT_PATIENT = { name: 'Ana Martínez', time: '14:30' };

const SOONEST_ACCESS = {
  patient: 'Ana Martínez',
  study: 'Ecocardiograma Doppler',
  remaining: { value: 47, unit: 'min' },
  progress: 0.78,
};

const WAITING_REQUESTS = 2;

const TODAY: { time: string; name: string; note: string; status: Status }[] = [
  { time: '09:00', name: 'Juan Pérez', note: 'Control · cargaste un ECG', status: 'attended' },
  { time: '11:15', name: 'Carla Gómez', note: 'Primera consulta', status: 'attended' },
  { time: '14:30', name: 'Ana Martínez', note: 'Ecocardiograma de control', status: 'next' },
  { time: '16:00', name: 'Roberto Luna', note: 'Control', status: 'later' },
];

const MY_ACCESSES = [
  { patient: 'Ana Martínez', remaining: '47 min', progress: 0.78 },
  { patient: 'Juan Pérez', remaining: '18 h', progress: 0.75 },
  { patient: 'Carla Gómez', remaining: '6 días', progress: 0.9 },
];

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
            {greeting(now)}, <ShellFirstName />
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
        <Tile asChild tone="navy" className="flex min-h-[260px] flex-col lg:col-span-6 bento:col-span-5">
          <Link href="/escanear">
            <TileDots />
            <svg aria-hidden="true" viewBox="0 0 250 250" className="relative size-16">
              <path
                d="M4 56V24a20 20 0 0 1 20-20h32M194 4h32a20 20 0 0 1 20 20v32M246 194v32a20 20 0 0 1-20 20h-32M56 246H24a20 20 0 0 1-20-20v-32"
                fill="none"
                stroke="#9fd8f7"
                strokeWidth={14}
                strokeLinecap="round"
              />
            </svg>
            <p className="relative mt-auto font-heading text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-white">
              Próximo paciente:
              <br />
              {NEXT_PATIENT.name}, {NEXT_PATIENT.time}
            </p>
            <p className="relative mt-1.5 text-sm text-salua-navy-ink">Pedile su QR y verificá el DNI en persona.</p>
          </Link>
        </Tile>

        <Tile asChild tone="mint" className="lg:col-span-6 bento:col-span-4">
          <Link href="/mis-accesos">
            <TileCross />
            <h2 className="relative font-sans text-[15px] font-semibold tracking-normal">Acceso que vence primero</h2>
            <p className="relative mt-1 text-[13px] text-salua-mint-ink">
              {SOONEST_ACCESS.patient} · {SOONEST_ACCESS.study}
            </p>
            <BigNumber
              value={SOONEST_ACCESS.remaining.value}
              unit={SOONEST_ACCESS.remaining.unit}
              className="relative mt-[22px]"
            />
            <ProgressTrack value={SOONEST_ACCESS.progress} className="relative mt-[18px]" />
          </Link>
        </Tile>

        <Tile tone="sky" className="flex flex-col lg:col-span-6 bento:col-span-3">
          <h2 className="font-sans text-[15px] font-semibold tracking-normal">Esperando respuesta</h2>
          <p className="mt-[18px] font-heading text-[56px] leading-[0.9] font-semibold tracking-[-0.04em] text-salua-navy tabular-nums">
            {WAITING_REQUESTS}
          </p>
          <p className="mt-2 text-[13px] leading-[1.45] text-salua-sky-ink">
            Pedidos de acceso que el paciente todavía no aprobó.
          </p>
          <Link href="/mis-accesos" className="mt-auto pt-3 text-[13px] font-semibold text-primary">
            Ver pedidos
          </Link>
        </Tile>

        <Tile className="lg:col-span-12 bento:col-span-8">
          <div className="flex items-baseline justify-between lg:px-2">
            <h2 className="text-lg">Pacientes de hoy</h2>
            <span className="text-[13px] text-muted-foreground">{TODAY.length} turnos</span>
          </div>
          <ul className="mt-1.5">
            {TODAY.map((visit) => (
              <li
                key={visit.time}
                className="grid grid-cols-[48px_40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-b border-salua-mute-soft py-3 transition-colors last:border-b-0 hover:bg-[#f8fafc] lg:grid-cols-[56px_40px_minmax(0,1fr)_auto] lg:gap-3.5 lg:px-2"
              >
                <span className="font-heading text-[15px] font-semibold text-salua-navy tabular-nums">{visit.time}</span>
                <UserAvatar name={visit.name} tone={visit.status === 'next' ? 'navy' : 'soft'} className="text-[13px]" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-salua-navy">{visit.name}</p>
                  <p className="text-[13px] text-muted-foreground">{visit.note}</p>
                </div>
                <StatusChip status={visit.status} />
              </li>
            ))}
          </ul>
        </Tile>

        <Tile className="lg:col-span-6 bento:col-span-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg">Mis accesos</h2>
            <Link href="/mis-accesos" className="text-[13px] font-semibold text-primary">
              Ver todos
            </Link>
          </div>
          <ul className="mt-3.5 flex flex-col gap-4">
            {MY_ACCESSES.map((access) => (
              <li key={access.patient}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-salua-navy">{access.patient}</span>
                  <span className="font-heading font-semibold text-salua-navy tabular-nums">{access.remaining}</span>
                </div>
                <ProgressTrack value={access.progress} thin className="mt-2" />
              </li>
            ))}
          </ul>
        </Tile>
      </div>
    </>
  );
}
