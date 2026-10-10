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
  /** One grant PDA per covered record — `revoke_access` signs each. */
  grantPdas: string[];
};

export type MyAccess = { requests: AccessRequest[]; grants: Grant[] };

/** A request covers every active study: "Toda tu historia". */
export const FULL_HISTORY = 'Toda tu historia';

export type ReadDeps = {
  get: <T>(path: string) => Promise<T>;
};

export type TxDeps = {
  post: <T>(path: string, body: unknown) => Promise<T>;
  sign: (txBase64: string) => Promise<string>;
};

/** `GET /access-requests/mine` row, after the service flattened the embeds. */
type ApiRequestRow = {
  request_id: string;
  /** 'revoked' / 'expired' come from the on-chain grants, not the off-chain row. */
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'revoked';
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
  granted_expires_at: string | null;
  doctor: {
    name: string;
    license: string;
    specialty: string;
    clinic: string | null;
    wallet_pubkey: string;
  } | null;
  records: {
    record_id: string;
    record_pda: string;
    grant_pda: string;
    /** What the AccessGrant account says now; 'missing' = approved but never signed. */
    grant_status: 'active' | 'revoked' | 'expired' | 'missing' | 'unknown';
  }[];
};

const toDoctor = (d: NonNullable<ApiRequestRow['doctor']>): Doctor => ({
  name: d.name,
  specialty: d.specialty,
  license: d.license,
  verified: true, // the API only lets verified doctors request access
});

function toAccess(row: ApiRequestRow): { request?: AccessRequest; grant?: Grant } {
  if (!row.doctor) return {};
  const doctor = toDoctor(row.doctor);
  const clinic = row.doctor.clinic ?? 'Sin clínica';
  const asRequest = (): AccessRequest => ({
    id: row.request_id,
    doctor,
    clinic,
    reason: row.reason ?? 'Quiere ver tu historia clínica.',
    requestedAt: Date.parse(row.created_at),
  });
  if (row.status === 'pending') return { request: asRequest() };
  if (row.status === 'approved' || row.status === 'revoked' || (row.status === 'expired' && row.records.length > 0)) {
    const expiresAt = row.granted_expires_at ? Date.parse(row.granted_expires_at) : 0;
    const signed = row.records.filter((record) => record.grant_status !== 'missing');
    // Approved but some grants were never signed (wallet prompt cancelled,
    // a grant_access failed): it stays in the inbox so approving again
    // signs only the missing ones (the API resumes the approval).
    const unsigned = row.status === 'approved' && signed.length < row.records.length && expiresAt > Date.now();
    const status: GrantStatus =
      row.status === 'revoked' ? 'revoked' : row.status === 'expired' || expiresAt <= Date.now() ? 'expired' : 'active';
    return {
      request: unsigned ? asRequest() : undefined,
      grant:
        signed.length > 0
          ? {
              id: row.request_id,
              doctor,
              clinic,
              scope: FULL_HISTORY,
              grantedAt: Date.parse(row.resolved_at ?? row.created_at),
              expiresAt,
              status,
              // Only grants still active on-chain can be revoked.
              grantPdas: signed.filter((record) => record.grant_status !== 'revoked').map((record) => record.grant_pda),
            }
          : undefined,
    };
  }
  return {};
}

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
        grantPdas: [],
      },
      {
        id: 'grant-paz',
        doctor: PAZ,
        clinic: 'Clínica del Sol',
        scope: FULL_HISTORY,
        grantedAt: now - 4 * DAY,
        expiresAt: now - 3 * DAY,
        status: 'revoked',
        grantPdas: [],
      },
      {
        id: 'grant-vega',
        doctor: VEGA,
        clinic: 'Centro Médico Norte',
        scope: 'Electrocardiograma',
        grantedAt: now - 10 * DAY,
        expiresAt: now - 9 * DAY,
        status: 'expired',
        grantPdas: [],
      },
    ],
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pending requests and every grant the patient gave. With API deps this is
 * `GET /access-requests/mine`; without them the sample set keeps demo mode
 * and the logic tests working.
 */
export async function getMyAccess(deps?: ReadDeps): Promise<MyAccess> {
  if (deps) {
    const { requests } = await deps.get<{ requests: ApiRequestRow[] }>('/access-requests/mine');
    const access: MyAccess = { requests: [], grants: [] };
    for (const row of requests) {
      const { request, grant } = toAccess(row);
      if (request) access.requests.push(request);
      if (grant) access.grants.push(grant);
    }
    return access;
  }
  await wait(300);
  return sampleAccess(Date.now());
}

export function expiryFor(duration: AccessDurationId, from: number): number {
  const { hours } = ACCESS_DURATIONS.find((d) => d.id === duration) ?? ACCESS_DURATIONS[1];
  return from + hours * HOUR;
}

const DURATION_SECONDS: Record<AccessDurationId, number> = {
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
};

type ApproveResponse = {
  request_id: string;
  status: 'approved';
  granted_expires_at: string;
  build_requests: {
    instruction: 'grant_access';
    signer: string;
    args: { record: string; doctor: string; expires_at: number };
    grant_pda: string;
  }[];
};

/**
 * Approves a request for the chosen time. `POST /access-requests/:id/approve`
 * marks it off-chain and returns one `grant_access` build request per active
 * study; the patient signs each, so the doctor's reads are checked by the
 * program (`components/onchain/tx-flow.ts`). Without deps the demo grant
 * stands in.
 */
export async function approveRequest(request: AccessRequest, duration: AccessDurationId, deps?: TxDeps): Promise<Grant> {
  if (deps) {
    const { runTx } = await import('@/components/onchain/tx-flow');
    const approved = await deps.post<ApproveResponse>(`/access-requests/${request.id}/approve`, {
      duration_seconds: DURATION_SECONDS[duration],
    });
    for (const build of approved.build_requests) {
      // The patient signs each grant in turn, so the awaits stay sequential.
      await runTx(
        { instruction: build.instruction, signer: build.signer, args: build.args },
        deps,
      );
    }
    const now = Date.now();
    return {
      id: approved.request_id,
      doctor: request.doctor,
      clinic: request.clinic,
      scope: FULL_HISTORY,
      grantedAt: now,
      expiresAt: Date.parse(approved.granted_expires_at),
      status: 'active',
      grantPdas: approved.build_requests.map((build) => build.grant_pda),
    };
  }
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
    grantPdas: [],
  };
}

/**
 * Declines a request: `POST /access-requests/:id/deny`. Off-chain only — the
 * doctor learns "no" without anything being written to Solana.
 */
export async function rejectRequest(id: string, deps?: Pick<TxDeps, 'post'>): Promise<void> {
  if (deps) {
    await deps.post(`/access-requests/${id}/deny`, {});
    return;
  }
  await wait(400);
  if (!id) throw new Error('not-found');
}

/**
 * Closes a grant before it expires. On-chain this is one `revoke_access` per
 * covered record, signed by the patient. Without deps (or a demo grant, which
 * carries no PDAs) the sample wait stands in.
 */
export async function revokeGrant(grant: Pick<Grant, 'id' | 'grantPdas'>, deps?: TxDeps, signer?: string): Promise<void> {
  if (deps) {
    // Never fall through to the demo path with a live API: no wallet or no
    // grant to revoke must fail, not report a revocation that never happened.
    if (!signer) throw new Error('wallet-unavailable');
    if (grant.grantPdas.length === 0) throw new Error('nothing-to-revoke');
    const { runTx } = await import('@/components/onchain/tx-flow');
    for (const grantPda of grant.grantPdas) {
      // The patient signs each revoke in turn, so the awaits stay sequential.
      await runTx({ instruction: 'revoke_access', signer, args: { grant: grantPda } }, deps);
    }
    return;
  }
  await wait(700);
  if (!grant.id) throw new Error('not-found');
}

export type AccessDeps = {
  /** POSTs JSON to the API with the user's session token. */
  post: <T>(path: string, body: unknown) => Promise<T>;
  /** GETs JSON from the API with the user's session token. */
  get: <T>(path: string) => Promise<T>;
};

/**
 * The doctor asks a patient for access. With API deps this is
 * `POST /access-requests`, which burns the one-time code. Without deps the
 * demo hook stands in: the code SAL-EEEE fails, so the error state shows.
 */
export async function requestAccess(
  input: { patientCode: string; reason: string },
  deps?: AccessDeps,
): Promise<{ id: string }> {
  if (deps) {
    const created = await deps.post<{ request_id: string }>('/access-requests', {
      patient_code: input.patientCode,
      // The API needs a reason; the UI keeps it optional.
      reason: input.reason.trim().length >= 3 ? input.reason.trim() : `Consulta${input.reason.trim() ? `: ${input.reason.trim()}` : ''}`,
    });
    return { id: created.request_id };
  }
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
