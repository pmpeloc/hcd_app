import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { StatusChip } from '@/components/status-chip';
import { Tile } from '@/components/tile';
import { DEMO_RECORDS } from '@/components/viewer/viewer-source';

// Sample grants until the API lists the doctor's active grants.
const SAMPLE_ACCESS = [
  { id: DEMO_RECORDS.ok, patient: 'Ana Martínez', study: 'Ecocardiograma Doppler', note: 'Te quedan 47 min', status: 'valid' as const },
  { id: DEMO_RECORDS.altered, patient: 'Ana Martínez', study: 'Electrocardiograma', note: 'Te quedan 47 min', status: 'valid' as const },
  { id: DEMO_RECORDS.expired, patient: 'Ana Martínez', study: 'Ecocardiograma Doppler', note: 'Se cerró hace 30 min', status: 'expired' as const },
];

export default function DoctorAccessPage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Mis accesos</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">Estudios que tus pacientes te dejaron ver, y hasta cuándo.</p>
      <Tile className="mt-4 max-w-3xl lg:mt-[22px]">
        <ul>
          {SAMPLE_ACCESS.map((a) => (
            <li key={a.id} className="border-b border-salua-mute-soft last:border-b-0">
              <Link
                href={`/visor/${a.id}`}
                className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 py-3.5 transition-colors lg:rounded-xl lg:px-2 lg:hover:bg-[#f8fafc]"
              >
                <IconWell size={40}>
                  <FileText />
                </IconWell>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-salua-navy">{a.study}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    {a.patient} · {a.note}
                  </span>
                </span>
                <StatusChip status={a.status} />
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Tile>
    </>
  );
}
