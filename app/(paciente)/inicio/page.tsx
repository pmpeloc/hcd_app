import Link from 'next/link';
import { Activity, ChevronRight, FileText, Image as ImageIcon, QrCode, type LucideIcon } from 'lucide-react';
import { ShellFirstName } from '@/components/app-shell/session-shell';
import { BigNumber } from '@/components/big-number';
import { IconWell } from '@/components/icon-well';
import { ProgressTrack } from '@/components/progress-track';
import { StatusChip } from '@/components/status-chip';
import { Tile, TileCross, TileDots } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PENDING_REQUEST = {
  doctor: 'Dra. Lucía Ríos',
  study: 'Ecocardiograma',
  detail: 'Cardióloga · MN 112.345 · Clínica del Sol',
};

const ACTIVE_GRANT = {
  doctor: 'Dr. Martín Sosa',
  study: 'Ecografía abdominal',
  remaining: { value: 21, unit: 'h' },
  progress: 0.87,
  closes: 'mañana a las 11:00',
};

const STUDIES: { name: string; origin: string; date: string; shortDate: string; icon: LucideIcon; copy?: boolean }[] = [
  { name: 'Hemograma completo', origin: 'Emitido por Centro Médico Norte', date: '12/09/2026', shortDate: '12/09', icon: FileText },
  { name: 'Ecografía abdominal', origin: 'Emitido por Centro Médico Norte', date: '03/09/2026', shortDate: '03/09', icon: ImageIcon },
  { name: 'Electrocardiograma', origin: 'Copia digitalizada por Dr. Pablo Vega', date: '21/08/2026', shortDate: '21/08', icon: Activity, copy: true },
];

const STUDY_COUNT = 4;

const ACCESS_LOG = [
  { text: 'Dr. Martín Sosa abrió Ecografía', when: 'Hoy · 10:12' },
  { text: 'Aprobaste 24 h a Dr. Sosa', when: 'Ayer · 11:00' },
  { text: 'Centro Médico Norte cargó Hemograma', when: '12/09 · 09:30' },
];

export default function PatientHomePage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">
        Hola, <ShellFirstName />
      </h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        <span className="lg:hidden">Tu historia clínica, bajo tu control.</span>
        <span className="hidden lg:inline">Tenés una solicitud para revisar y un permiso abierto.</span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:mt-[22px] lg:grid-flow-row-dense lg:grid-cols-12 lg:gap-4">
        <Tile tone="navy" className="col-span-2 flex flex-col p-[18px] lg:col-span-6 bento:col-span-5">
          <TileDots />
          <StatusChip status="pending" label="Solicitud pendiente" className="relative self-start" />
          <h2 className="relative mt-2.5 text-lg leading-[1.3] tracking-[-0.01em] text-white lg:mt-3.5 lg:text-2xl lg:leading-[1.2]">
            La {PENDING_REQUEST.doctor} quiere ver tu {PENDING_REQUEST.study}
          </h2>
          <p className="relative mt-1 text-[13px] text-salua-navy-ink lg:mt-1.5 lg:text-sm">
            {PENDING_REQUEST.detail} · verificada
          </p>
          <Button asChild variant="white" className="relative mt-3.5 h-10 self-start px-4 text-sm lg:mt-auto lg:h-11 lg:px-5 lg:text-[15px]">
            <Link href="/accesos">
              Revisar y decidir
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </Tile>

        <Tile tone="mint" className="col-span-2 p-[18px] lg:col-span-6 bento:col-span-4">
          <TileCross className="-top-[26px] -right-[26px] w-[130px] lg:-top-[30px] lg:-right-[30px] lg:w-[150px]" />
          <div className="relative flex items-end justify-between gap-3 lg:block">
            <div>
              <h2 className="font-sans text-sm font-semibold tracking-normal lg:text-[15px]">Permiso activo</h2>
              <p className="mt-1 text-[13px] text-salua-mint-ink">
                {ACTIVE_GRANT.doctor} · {ACTIVE_GRANT.study}
              </p>
            </div>
            <BigNumber
              value={ACTIVE_GRANT.remaining.value}
              unit={ACTIVE_GRANT.remaining.unit}
              className="text-[76px] lg:mt-[22px] lg:text-[104px]"
            />
          </div>
          <ProgressTrack value={ACTIVE_GRANT.progress} className="relative mt-3.5 lg:mt-[18px]" />
          <div className="relative mt-2 flex items-center justify-between gap-2 lg:mt-2.5">
            <p className="text-xs text-salua-mint-ink lg:text-[13px]">Se cierra solo {ACTIVE_GRANT.closes}</p>
            <button type="button" className="text-[13px] font-semibold text-salua-error-ink underline underline-offset-3">
              Revocar
            </button>
          </div>
        </Tile>

        <Tile asChild className="lg:hidden">
          <Link href="/estudios">
            <h2 className="font-sans text-sm font-semibold tracking-normal">Mis estudios</h2>
            <p className="mt-3.5 font-heading text-[44px] leading-[0.9] font-semibold tracking-[-0.04em] text-salua-navy tabular-nums">
              {STUDY_COUNT}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Último: {STUDIES[0].shortDate}</p>
          </Link>
        </Tile>

        <Tile asChild tone="sky" className="flex flex-col justify-between lg:col-span-6 lg:min-h-60 bento:col-span-3">
          <Link href="/qr">
            <IconWell size={52} className="size-11 bg-white lg:size-[52px]">
              <QrCode />
            </IconWell>
            <div className="mt-3.5">
              <h2 className="font-sans text-sm font-semibold tracking-normal lg:font-heading lg:text-xl lg:tracking-[-0.02em]">
                Mi QR
              </h2>
              <p className="mt-0.5 text-xs leading-[1.45] text-salua-sky-ink lg:mt-1 lg:text-[13px]">
                <span className="lg:hidden">Para tu próxima consulta</span>
                <span className="hidden lg:inline">Mostralo en la consulta. Vence a los 2 minutos.</span>
              </p>
            </div>
          </Link>
        </Tile>

        <Tile className="col-span-2 lg:col-span-12 bento:col-span-8">
          <div className="flex items-baseline justify-between lg:px-2">
            <h2 className="text-base lg:text-lg">
              <span className="lg:hidden">Últimos estudios</span>
              <span className="hidden lg:inline">Mis estudios</span>
            </h2>
            <Link href="/estudios" className="text-[13px] font-semibold text-primary lg:text-sm">
              <span className="lg:hidden">Ver todos</span>
              <span className="hidden lg:inline">Ver los {STUDY_COUNT}</span>
            </Link>
          </div>
          <ul className="mt-1 lg:mt-1.5">
            {STUDIES.map((study, i) => (
              <li
                key={study.name}
                className={cn(
                  'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-salua-mute-soft py-3 last:border-b-0 lg:grid-cols-[44px_minmax(0,1fr)_auto] lg:gap-3.5 bento:grid-cols-[44px_minmax(0,1fr)_auto_auto] lg:rounded-xl lg:px-2 lg:py-3.5 lg:transition-colors lg:hover:bg-[#f8fafc]',
                  i === 1 && 'border-b-0 lg:border-b',
                  i >= 2 && 'hidden lg:grid',
                )}
              >
                <IconWell size={40} className="lg:size-11">
                  <study.icon />
                </IconWell>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-salua-navy">{study.name}</p>
                  <p className="text-xs text-muted-foreground lg:text-[13px]">
                    <span className="bento:hidden">{study.shortDate} · </span>
                    {study.origin}
                  </p>
                </div>
                <span className="hidden text-[13px] text-muted-foreground tabular-nums bento:inline">{study.date}</span>
                <StatusChip status={study.copy ? 'copy' : 'verified'} />
              </li>
            ))}
          </ul>
        </Tile>

        <Tile className="hidden lg:col-span-6 lg:block bento:col-span-4">
          <h2 className="text-lg">Registro de accesos</h2>
          <ol className="mt-4">
            {ACCESS_LOG.map((entry) => (
              <li
                key={entry.text}
                className="relative pb-4 pl-[22px] before:absolute before:top-1.5 before:left-1 before:size-[9px] before:rounded-full before:bg-salua-blue after:absolute after:top-[18px] after:bottom-0.5 after:left-2 after:w-px after:bg-salua-line-strong last:after:hidden"
              >
                <p className="text-sm font-semibold text-salua-navy">{entry.text}</p>
                <p className="text-xs text-muted-foreground">{entry.when}</p>
              </li>
            ))}
          </ol>
          <Link href="/linea-de-tiempo" className="text-[13px] font-semibold text-primary">
            Ver comprobante
          </Link>
        </Tile>
      </div>
    </>
  );
}
