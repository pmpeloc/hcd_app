'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { StatusChip } from '@/components/status-chip';
import { Tile } from '@/components/tile';
import { createApiClient } from '@/lib/api-client';
import { useSession } from '@/lib/session-provider';
import { formatRemaining } from '@/components/access/access-source';

export type DoctorRecord = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  patient: string;
  grant: { granted_at: string | null; expires_at: string | null } | null;
};

export type DoctorRequest = {
  request_id: string;
  status: string;
  reason: string | null;
  created_at: string;
  granted_expires_at: string | null;
  patient: string;
  record_count: number;
};

type DoctorWork = { records: DoctorRecord[]; requests: DoctorRequest[] };

/** Live doctor data for the panel: pending requests, expiring grants and
 * openable records. Everything comes from `GET /doctors/me/records`. */
export function DoctorLivePanel() {
  const { session, loading } = useSession();
  const [work, setWork] = useState<DoctorWork | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (loading || !session) return;
    let live = true;
    void createApiClient()
      .get<DoctorWork>('/doctors/me/records')
      .then((data) => {
        if (!live) return;
        setWork(data);
        setNow(Date.now());
      })
      .catch(() => live && setWork({ records: [], requests: [] }));
    return () => {
      live = false;
    };
  }, [session, loading]);

  if (loading || !session || work === null) return null;

  const pending = work.requests.filter((r) => r.status === 'pending');
  const expiring = work.records
    .filter((r) => r.grant?.expires_at && Date.parse(r.grant.expires_at) > now)
    .sort(
      (a, b) => Date.parse(a.grant!.expires_at!) - Date.parse(b.grant!.expires_at!),
    )[0];

  return (
    <>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:mt-[22px]">
        <Tile className="flex min-h-[150px] flex-col justify-between">
          {expiring ? (
            <>
              <div>
                <p className="text-sm font-semibold text-salua-mint-ink">Acceso que vence primero</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {expiring.patient} · {expiring.title ?? 'Estudio sin título'}
                </p>
              </div>
              {(() => {
                const { value, unit } = formatRemaining(
                  Date.parse(expiring.grant!.expires_at!) - now,
                );
                return (
                  <p className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.03em] text-salua-navy tabular-nums">
                    {value}
                    <span className="ml-1.5 text-[15px] font-normal text-muted-foreground">{unit}</span>
                  </p>
                );
              })()}
            </>
          ) : (
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-sm font-semibold text-salua-mint-ink">Acceso que vence primero</p>
              <p className="mt-2 text-sm text-muted-foreground">No tenés accesos vigentes.</p>
            </div>
          )}
        </Tile>
        <Tile className="flex min-h-[150px] flex-col justify-between">
          <div>
            <p className="text-sm font-semibold text-salua-navy">Esperando respuesta</p>
            <p className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.03em] text-salua-navy">
              {pending.length}
            </p>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {pending.length === 0
              ? 'No tenés pedidos pendientes.'
              : 'Pedidos de acceso que el paciente todavía no aprobó.'}
          </p>
        </Tile>
      </div>

      <Tile className="mt-3 lg:mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-salua-navy">Mis accesos</h2>
          <Link href="/mis-accesos" className="text-sm font-medium text-salua-mint-ink hover:underline">
            Ver todos
          </Link>
        </div>
        {work.records.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no tenés estudios para abrir. Cuando cargues uno o un paciente te apruebe, aparece acá.
          </p>
        ) : (
          <ul className="mt-1">
            {work.records.slice(0, 4).map((record) => {
              const until = record.grant?.expires_at
                ? Date.parse(record.grant.expires_at)
                : null;
              const live = until !== null && until > now;
              return (
                <li key={record.id} className="border-b border-salua-mute-soft last:border-b-0">
                  <Link
                    href={`/visor/${record.id}`}
                    className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 py-3 transition-colors lg:rounded-xl lg:px-2 lg:hover:bg-[#f8fafc]"
                  >
                    <IconWell size={40}>
                      <FileText />
                    </IconWell>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-salua-navy">
                        {record.title ?? 'Estudio sin título'}
                      </span>
                      <span className="block text-[13px] text-muted-foreground">
                        {record.patient}
                        {until
                          ? live
                            ? ` · Te quedan ${formatRemaining(until - now).value} ${formatRemaining(until - now).unit}`
                            : ' · Acceso cerrado'
                          : ' · Emitido por vos'}
                      </span>
                    </span>
                    <StatusChip
                      status={
                        record.status === 'pending_chain'
                          ? 'pending'
                          : until !== null && until <= now
                            ? 'expired'
                            : until === null
                              ? 'verified'
                              : 'valid'
                      }
                      label={until === null ? 'Emitido' : undefined}
                    />
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Tile>
    </>
  );
}
