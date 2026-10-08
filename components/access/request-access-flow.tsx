'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Check, RefreshCw, ScanLine, Send } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { Tile, TileCross } from '@/components/tile';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user-avatar';
import { requestAccess } from './access-source';

export const REASON_MAX = 140;

type Status = 'editing' | 'sending' | 'sent' | 'failed';

type Patient = { name: string; code: string; since: string; studyCount: number };

export function RequestAccessFlow({ patient }: { patient: Patient }) {
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<Status>('editing');
  const ids = { reason: useId(), hint: useId() };
  const firstName = patient.name.split(' ')[0];
  const sending = status === 'sending';

  const send = async () => {
    setStatus('sending');
    try {
      await requestAccess({ patientCode: patient.code, reason: reason.trim() });
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="mt-4 grid grid-cols-1 gap-2.5 lg:mt-[22px] lg:grid-cols-12 lg:gap-4">
      <p aria-live="polite" className="sr-only">
        {status === 'sent' ? `Solicitud enviada a ${patient.name}.` : ''}
      </p>

      <Tile aria-label="Paciente" className="self-start lg:col-span-5">
        <div className="flex items-center gap-3.5">
          <UserAvatar name={patient.name} size={52} />
          <div className="min-w-0">
            <p className="font-heading text-xl leading-[1.15] font-semibold tracking-[-0.02em] text-salua-navy">{patient.name}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">{patient.code}</span> · Paciente desde {patient.since} · {patient.studyCount} estudios
            </p>
          </div>
        </div>
      </Tile>

      {status === 'sent' ? (
        <Tile tone="mint" className="flex flex-col items-start gap-3 lg:col-span-7">
          <TileCross />
          <IconWell tone="teal" size={52} className="relative bg-white">
            <Check />
          </IconWell>
          <h2 className="relative text-xl lg:text-2xl">Solicitud enviada</h2>
          <p className="relative max-w-md text-sm leading-normal text-salua-mint-ink">
            {firstName} la ve en su app y elige por cuánto tiempo. Si no responde, la respuesta es no.
          </p>
          <div className="relative mt-1 flex flex-wrap gap-2.5">
            <Button asChild>
              <Link href="/mis-accesos">Ver mis accesos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/escanear">
                <ScanLine aria-hidden="true" />
                Atender a otro paciente
              </Link>
            </Button>
          </div>
        </Tile>
      ) : (
        <Tile className="flex flex-col lg:col-span-7">
          <h2 className="font-sans text-[15px] font-semibold tracking-normal">Qué le vas a pedir</h2>
          <dl className="mt-2">
            {[
              ['Ver', `Toda su historia (${patient.studyCount} estudios)`],
              ['Descargar', 'No, solo lectura con marca de agua'],
              ['Duración', `La elige ${firstName}: 1 h, 24 h o 7 días`],
            ].map(([term, value]) => (
              <div key={term} className="flex justify-between gap-3 border-b border-salua-mute-soft py-2.5 text-sm last:border-b-0">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="text-right font-semibold text-salua-navy">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-col gap-2">
            <Label htmlFor={ids.reason}>Motivo (opcional)</Label>
            <textarea
              id={ids.reason}
              aria-describedby={ids.hint}
              value={reason}
              maxLength={REASON_MAX}
              rows={2}
              disabled={sending}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: control cardiológico de hoy"
              className="w-full min-w-0 resize-none rounded-xl border-[1.5px] border-input bg-card px-3.5 py-3 text-base text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-accent disabled:bg-muted disabled:opacity-60 md:text-[15px]"
            />
            <p id={ids.hint} className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>{firstName} lo lee antes de decidir.</span>
              <span className="tabular-nums">
                {reason.length}/{REASON_MAX}
              </span>
            </p>
          </div>

          {status === 'failed' && (
            <p role="alert" className="mt-3 text-sm text-salua-error-ink">
              No pudimos enviar la solicitud. Revisá tu conexión y probá de nuevo.
            </p>
          )}

          <Button onClick={() => void send()} disabled={sending} className="mt-4 self-start">
            {status === 'failed' ? <RefreshCw aria-hidden="true" /> : <Send aria-hidden="true" />}
            {sending ? 'Enviando…' : status === 'failed' ? 'Reintentar' : 'Enviar solicitud'}
          </Button>
        </Tile>
      )}
    </div>
  );
}
