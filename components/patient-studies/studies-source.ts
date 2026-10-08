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
};

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
 * The signed-in patient's studies, newest first.
 * Placeholder: swap for `GET /patients/me/records` once the API exposes it.
 */
export async function getMyStudies(): Promise<Study[]> {
  await wait(300);
  return [...SAMPLE_STUDIES].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Marks a study as "not mine". On-chain this is `dispute_record`, signed by the patient.
 * Placeholder: swap for `/tx/build` + Privy signature + `/tx/submit`.
 */
export async function disputeStudy(id: string): Promise<void> {
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
