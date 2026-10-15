/**
 * The patient's audit trail: on-chain events the API indexer mirrored into
 * `audit_events`, newest first. `GET /patients/me/timeline`.
 */

export type TimelineEventKind =
  | 'record_issued'
  | 'record_disputed'
  | 'record_voided'
  | 'access_granted'
  | 'access_revoked'
  | 'access_logged';

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  /** When the transaction confirmed on-chain. */
  at: number;
  /** The study the event touches, when the API resolved it. */
  recordTitle: string | null;
  /** The clinic behind the actor's wallet. */
  organization: string | null;
  /** The wallet that signed the transaction (shortened for display). */
  actorWallet: string | null;
  txSignature: string | null;
};

export type TimelineDeps = {
  get: <T>(path: string) => Promise<T>;
};

type ApiTimelineRow = {
  id: string;
  event_type: string;
  tx_signature: string | null;
  created_at: string;
  record_id: string | null;
  actor_wallet: string | null;
  records: { title: string | null } | null;
  organizations: { name: string } | null;
};

const KNOWN_KINDS = new Set<TimelineEventKind>([
  'record_issued',
  'record_disputed',
  'record_voided',
  'access_granted',
  'access_revoked',
  'access_logged',
]);

const shortWallet = (wallet: string | null) =>
  wallet && wallet.length > 8 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;

function toEvent(row: ApiTimelineRow): TimelineEvent | null {
  if (!KNOWN_KINDS.has(row.event_type as TimelineEventKind)) return null;
  return {
    id: row.id,
    kind: row.event_type as TimelineEventKind,
    at: Date.parse(row.created_at),
    recordTitle: row.records?.title ?? null,
    organization: row.organizations?.name ?? null,
    actorWallet: shortWallet(row.actor_wallet),
    txSignature: row.tx_signature,
  };
}

export async function getTimeline(deps: TimelineDeps): Promise<TimelineEvent[]> {
  const rows = await deps.get<ApiTimelineRow[]>('/patients/me/timeline');
  return rows
    .map(toEvent)
    .filter((event): event is TimelineEvent => event !== null);
}

const EXPLORER = 'https://explorer.solana.com/tx';

export function explorerTxUrl(signature: string): string {
  return `${EXPLORER}/${signature}?cluster=devnet`;
}

export const EVENT_LABEL: Record<TimelineEventKind, string> = {
  record_issued: 'Cargaron un estudio',
  record_disputed: 'Marcaste que un estudio no es tuyo',
  record_voided: 'Anularon un estudio',
  access_granted: 'Aprobaste un acceso',
  access_revoked: 'Revocaste un acceso',
  access_logged: 'Abrieron un estudio',
};

export const EVENT_WHO: Record<TimelineEventKind, 'actor' | 'you'> = {
  record_issued: 'actor',
  record_disputed: 'you',
  record_voided: 'actor',
  access_granted: 'you',
  access_revoked: 'you',
  access_logged: 'actor',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "15/10 · 14:32" in local time. */
export function formatEventTime(at: number): string {
  const d = new Date(at);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
