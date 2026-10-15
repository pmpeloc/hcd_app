'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { StatusChip } from '@/components/status-chip';
import { Tile } from '@/components/tile';
import { createApiClient } from '@/lib/api-client';
import { useSession } from '@/lib/session-provider';
import { DEMO_DATA } from '@/lib/demo';
import { formatRemaining, formatCloses } from '@/components/access/access-source';
import { DEMO_RECORDS } from '@/components/viewer/viewer-source';

type DoctorRecord = {
  id: string;
  title: string | null;
  study_date: string | null;
  origin: 'issued' | 'digitized' | null;
  issuer_name: string | null;
  issuer_org: string | null;
  status: string;
  created_at: string;
  patient: string;
  grant: { granted_at: string | null; expires_at: string | null } | null;
};

type DoctorAccess = { records: DoctorRecord[] };

const SAMPLE_ACCESS = [
  { id: DEMO_RECORDS.ok, patient: 'Ana Martínez', study: 'Ecocardiograma Doppler', note: 'Te quedan 47 min', status: 'valid' as const },
  { id: DEMO_RECORDS.altered, patient: 'Ana Martínez', study: 'Electrocardiograma', note: 'Te quedan 47 min', status: 'valid' as const },
  { id: DEMO_RECORDS.expired, patient: 'Ana Martínez', study: 'Ecocardiograma Doppler', note: 'Se cerró hace 30 min', status: 'expired' as const },
];

function noteFor(record: DoctorRecord, now: number): string {
  if (record.status === 'pending_chain') return 'Registrándose en la cadena…';
  const until = record.grant?.expires_at ? Date.parse(record.grant.expires_at) : null;
  if (until) {
    if (until <= now) return `Se cerró ${formatCloses(until, now)}`;
    const { value, unit } = formatRemaining(until - now);
    return `Te quedan ${value} ${unit}`;
  }
  return 'Emitido por vos';
}

function chipFor(record: DoctorRecord, now: number) {
  const until = record.grant?.expires_at ? Date.parse(record.grant.expires_at) : null;
  if (record.status === 'pending_chain') return { status: 'pending' as const, label: undefined };
  if (until && until <= now) return { status: 'expired' as const, label: undefined };
  if (!record.grant) return { status: 'verified' as const, label: 'Emitido' };
  return { status: 'valid' as const, label: undefined };
}

export default function DoctorAccessPage() {
  const { session, loading } = useSession();
  const [records, setRecords] = useState<DoctorRecord[] | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (loading || !session) return;
    let live = true;
    void createApiClient()
      .get<DoctorAccess>('/doctors/me/records')
      .then((data) => {
        if (!live) return;
        setRecords(data.records);
        setNow(Date.now());
      })
      .catch(() => live && setRecords([]));
    return () => {
      live = false;
    };
  }, [session, loading]);

  const demo = !session && DEMO_DATA;
  // Signed-out views never show a previous session's records.
  const shown = session ? records : null;
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Mis accesos</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">Estudios que tus pacientes te dejaron ver, y hasta cuándo.</p>
      <Tile className="mt-4 max-w-3xl lg:mt-[22px]">
        {demo ? (
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
        ) : shown === null ? (
          <p className="py-6 text-sm text-muted-foreground">Cargando…</p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Todavía no tenés accesos. Cuando un paciente te apruebe o cargues un estudio, aparece acá.
          </p>
        ) : (
          <ul>
            {shown.map((record) => (
              <li key={record.id} className="border-b border-salua-mute-soft last:border-b-0">
                <Link
                  href={`/visor/${record.id}`}
                  className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 py-3.5 transition-colors lg:rounded-xl lg:px-2 lg:hover:bg-[#f8fafc]"
                >
                  <IconWell size={40}>
                    <FileText />
                  </IconWell>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-salua-navy">
                      {record.title ?? 'Estudio sin título'}
                    </span>
                    <span className="block text-[13px] text-muted-foreground">
                      {record.patient} · {noteFor(record, now)}
                    </span>
                  </span>
                  <StatusChip
                    status={chipFor(record, now).status}
                    label={chipFor(record, now).label}
                  />
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tile>
    </>
  );
}
