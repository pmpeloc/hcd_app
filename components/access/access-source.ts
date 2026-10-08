import { ACCESS_DURATIONS, type AccessDurationId } from '@/components/duration-selector';

export type Doctor = {
  name: string;
  specialty: string;
  /** Matrícula, e.g. "MN 112.345". */
  license: string;
  /** The clinic vouched for the doctor and an admin checked the license. */
  verified: boolean;
};

/** A doctor asking to read the patient's history. Off-chain until the patient approves. */
export type AccessRequest = {
  id: string;
  doctor: Doctor;
  clinic: string;
  reason: string;
  requestedAt: number;
};

export type GrantStatus = 'active' | 'expired' | 'revoked';

/** Mirrors the on-chain AccessGrant: who can read what, until when. */
export type Grant = {
  id: string;
  doctor: Doctor;
  clinic: string;
  /** What the doctor can read, as the patient sees it. */
  scope: string;
  grantedAt: number;
  expiresAt: number;
  status: GrantStatus;
};

export type MyAccess = { requests: AccessRequest[]; grants: Grant[] };

/** A request covers every active study: "Toda tu historia". */
export const FULL_HISTORY = 'Toda tu historia';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const RIOS: Doctor = { name: 'Dra. Lucía Ríos', specialty: 'Cardióloga', license: 'MN 112.345', verified: true };
const SOSA: Doctor = { name: 'Dr. Martín Sosa', specialty: 'Gastroenterólogo', license: 'MN 98.761', verified: true };
const VEGA: Doctor = { name: 'Dr. Pablo Vega', specialty: 'Clínico', license: 'MP 45.210', verified: true };
const PAZ: Doctor = { name: 'Dra. Inés Paz', specialty: 'Dermatóloga', license: 'MN 130.882', verified: true };

function sampleAccess(now: number): MyAccess {
  return {
    requests: [
      {
        id: 'req-rios',
        doctor: RIOS,
        clinic: 'Clínica del Sol',
        reason: 'Quiere ver tu historia clínica para tu consulta de hoy.',
        requestedAt: now - 12 * MINUTE,
      },
    ],
    grants: [
      {
        id: 'grant-sosa',
        doctor: SOSA,
        clinic: 'Centro Médico Norte',
        scope: 'Ecografía abdominal',
        grantedAt: now - 3 * HOUR,
        expiresAt: now + 21 * HOUR,
        status: 'active',
      },
      {
        id: 'grant-paz',
        doctor: PAZ,
        clinic: 'Clínica del Sol',
        scope: FULL_HISTORY,
        grantedAt: now - 4 * DAY,
        expiresAt: now - 3 * DAY,
        status: 'revoked',
      },
      {
        id: 'grant-vega',
        doctor: VEGA,
        clinic: 'Centro Médico Norte',
        scope: 'Electrocardiograma',
        grantedAt: now - 10 * DAY,
        expiresAt: now - 9 * DAY,
        status: 'expired',
      },
    ],
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pending requests and every grant the patient gave.
 * Placeholder: swap for `GET /access-requests/mine` plus the patient's grants once the API exposes them.
 */
export async function getMyAccess(): Promise<MyAccess> {
  await wait(300);
  return sampleAccess(Date.now());
}

export function expiryFor(duration: AccessDurationId, from: number): number {
  const { hours } = ACCESS_DURATIONS.find((d) => d.id === duration) ?? ACCESS_DURATIONS[1];
  return from + hours * HOUR;
}

/**
 * Approves a request for the chosen time. On-chain the patient signs one `grant_access` per active
 * study (`components/onchain/tx-flow.ts`), so the doctor's reads are checked by the program.
 * Placeholder until `GET /patients/me/records` gives the record PDAs and the wallet can sign.
 */
export async function approveRequest(request: AccessRequest, duration: AccessDurationId): Promise<Grant> {
  await wait(800);
  const now = Date.now();
  return {
    id: `grant-${request.id}`,
    doctor: request.doctor,
    clinic: request.clinic,
    scope: FULL_HISTORY,
    grantedAt: now,
    expiresAt: expiryFor(duration, now),
    status: 'active',
  };
}

/** Declines a request. Off-chain only. Placeholder: needs an endpoint in the access module. */
export async function rejectRequest(id: string): Promise<void> {
  await wait(400);
  if (!id) throw new Error('not-found');
}

/** Closes a grant before it expires. On-chain this is `revoke_access`, signed by the patient. Placeholder. */
export async function revokeGrant(id: string): Promise<void> {
  await wait(700);
  if (!id) throw new Error('not-found');
}

/**
 * The doctor asks a patient for access. Placeholder: swap for `POST /access-requests`.
 * Demo hook: the code SAL-EEEE fails, so the error state can be shown.
 */
export async function requestAccess(input: { patientCode: string; reason: string }): Promise<{ id: string }> {
  await wait(700);
  if (input.patientCode === 'SAL-EEEE') throw new Error('request-failed');
  return { id: `req-${input.patientCode.toLowerCase()}` };
}

/**
 * Time left on a grant in the unit the patient reads at a glance. Rounded to the nearest unit,
 * so a grant just approved for 24 h reads "24 h", not "23 h".
 */
export function formatRemaining(ms: number): { value: number; unit: string } {
  if (ms <= 0) return { value: 0, unit: 'min' };
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return { value: minutes, unit: 'min' };
  const hours = Math.round(ms / HOUR);
  if (hours < 48) return { value: hours, unit: 'h' };
  return { value: Math.round(ms / DAY), unit: 'días' };
}

const pad = (n: number) => String(n).padStart(2, '0');

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "hoy a las 15:13", "mañana a las 14:13" or "el 15/10 a las 09:00", in local time. */
export function formatCloses(at: number, now: number): string {
  const d = new Date(at);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY);
  if (days === 0) return `hoy a las ${time}`;
  if (days === 1) return `mañana a las ${time}`;
  return `el ${pad(d.getDate())}/${pad(d.getMonth() + 1)} a las ${time}`;
}

/** "Hace 12 min", "Hace 3 h", "Ayer", "Hace 4 días". */
export function formatAgo(at: number, now: number): string {
  const ms = Math.max(0, now - at);
  if (ms < MINUTE) return 'Recién';
  if (ms < HOUR) return `Hace ${Math.floor(ms / MINUTE)} min`;
  if (ms < DAY) return `Hace ${Math.floor(ms / HOUR)} h`;
  const days = Math.floor(ms / DAY);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

/** Share of the grant still left, 0–1, for the progress track. */
export function grantProgress(grant: Pick<Grant, 'grantedAt' | 'expiresAt'>, now: number): number {
  const total = grant.expiresAt - grant.grantedAt;
  return total > 0 ? Math.min(1, Math.max(0, (grant.expiresAt - now) / total)) : 0;
}

/** A grant past its expiry is expired even before the indexer says so. */
export function effectiveStatus(grant: Grant, now: number): GrantStatus {
  return grant.status === 'active' && grant.expiresAt <= now ? 'expired' : grant.status;
}
