/** Mirrors the on-chain Record status. */
export type StudyStatus = 'active' | 'disputed' | 'voided';

export type StudyKind = 'lab' | 'imaging' | 'cardio' | 'other';

export type Study = {
  id: string;
  name: string;
  kind: StudyKind;
  /** ISO date (YYYY-MM-DD) of the study itself. */
  date: string;
  /** "issued" by the institution, or a "digitized" copy uploaded by a doctor. */
  origin: { type: 'issued'; by: string } | { type: 'digitized'; by: string };
  status: StudyStatus;
  /** Still `pending_chain`: uploaded and registered, not yet anchored by the indexer. */
  pending?: boolean;
  /** The record's on-chain PDA — needed to sign `dispute_record`. */
  recordPda?: string;
};

export type StudiesDeps = {
  get: <T>(path: string) => Promise<T>;
};

export type DisputeDeps = {
  post: <T>(path: string, body: unknown) => Promise<T>;
  sign: (txBase64: string) => Promise<string>;
};

type ApiRecord = {
  id: string;
  record_pda: string | null;
  status: 'pending_chain' | 'active' | 'disputed' | 'voided';
  created_at: string;
  title: string | null;
  study_date: string | null;
  origin: 'issued' | 'digitized' | null;
  issuer_name: string | null;
  issuer_org: string | null;
};

const KIND_HINTS: [RegExp, StudyKind][] = [
  [/hemograma|laboratorio|an[áa]lisis|sangre|orina|perfil/i, 'lab'],
  [/electrocardiograma|ecocardiograma|cardio|holter|ergometr/i, 'cardio'],
  [/eco|radio|resonancia|tomograf|mamograf|ecograf|imagen|rx|tac|irm/i, 'imaging'],
];

function kindOf(title: string | null): StudyKind {
  for (const [re, kind] of KIND_HINTS) if (re.test(title ?? '')) return kind;
  return 'other';
}

function toStudy(record: ApiRecord): Study {
  return {
    id: record.id,
    name: record.title ?? 'Estudio',
    kind: kindOf(record.title),
    date: record.study_date ?? record.created_at.slice(0, 10),
    origin:
      record.origin === 'digitized'
        ? { type: 'digitized', by: record.issuer_name ?? record.issuer_org ?? 'un profesional' }
        : { type: 'issued', by: record.issuer_org ?? record.issuer_name ?? 'una institución' },
    status: record.status === 'pending_chain' ? 'active' : record.status,
    pending: record.status === 'pending_chain',
    recordPda: record.record_pda ?? undefined,
  };
}

const SAMPLE_STUDIES: Study[] = [
  {
    id: 'rec-hemograma',
    name: 'Hemograma completo',
    kind: 'lab',
    date: '2026-09-12',
    origin: { type: 'issued', by: 'Centro Médico Norte' },
    status: 'active',
  },
  {
    id: 'rec-eco-abdominal',
    name: 'Ecografía abdominal',
    kind: 'imaging',
    date: '2026-09-03',
    origin: { type: 'issued', by: 'Centro Médico Norte' },
    status: 'active',
  },
  {
    id: 'rec-ecg',
    name: 'Electrocardiograma',
    kind: 'cardio',
    date: '2026-08-21',
    origin: { type: 'digitized', by: 'Dr. Pablo Vega' },
    status: 'disputed',
  },
  {
    id: 'rec-rx-torax',
    name: 'Radiografía de tórax',
    kind: 'imaging',
    date: '2026-07-02',
    origin: { type: 'issued', by: 'Clínica del Sol' },
    status: 'voided',
  },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The signed-in patient's studies, newest first. With API deps this is
 * `GET /patients/me/records`; without them the sample list keeps demo mode
 * and the logic tests working.
 */
export async function getMyStudies(deps?: StudiesDeps): Promise<Study[]> {
  if (deps) {
    const page = await deps.get<{ records: ApiRecord[] }>(
      '/patients/me/records?limit=100',
    );
    return page.records
      .map(toStudy)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  await wait(300);
  return [...SAMPLE_STUDIES].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Marks a study as "not mine". On-chain this is `dispute_record`, signed by
 * the patient with the record's PDA; a pending (not yet anchored) record has
 * no PDA and cannot be disputed yet.
 */
export async function disputeStudy(
  id: string,
  deps?: DisputeDeps & { recordPda?: string; signer?: string },
): Promise<void> {
  if (deps) {
    if (!deps.recordPda || !deps.signer) throw new Error('pending');
    const { runTx } = await import('@/components/onchain/tx-flow');
    await runTx(
      {
        instruction: 'dispute_record',
        signer: deps.signer,
        args: { record: deps.recordPda },
      },
      deps,
    );
    return;
  }
  await wait(700);
  if (!SAMPLE_STUDIES.some((s) => s.id === id)) throw new Error('not-found');
}

export function originLabel(origin: Study['origin']): string {
  return origin.type === 'issued' ? `Emitido por ${origin.by}` : `Copia digitalizada por ${origin.by}`;
}

export function formatStudyDate(iso: string, style: 'short' | 'long' = 'long'): string {
  const [y, m, d] = iso.split('-');
  return style === 'short' ? `${d}/${m}` : `${d}/${m}/${y}`;
}
