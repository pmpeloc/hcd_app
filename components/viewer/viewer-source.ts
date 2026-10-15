// The viewer depends on the authenticated API client that app#11 introduced
// (lib/api-client.ts): this branch must merge after that one.
import { createApiClient } from '@/lib/api-client';
import type { Study } from '@/components/patient-studies/studies-source';
import { encryptFile, exportDek, generateDek, sha256Hex } from '@/lib/crypto';
import { OpenError, type OpenDeps, type ReleasedKey } from './open-record';
import { bytesToBase64, sealFile } from './sealed-file';

/** What the viewer shows around the document. */
export type ViewerRecord = {
  id: string;
  studyName: string;
  patient: { name: string; code: string };
  origin: Study['origin'];
  /** Who signed `issue_record`. */
  signedBy: string;
  uploadedAt: number;
  /** The patient's grant to this doctor, if any. */
  grant: { grantedAt: number; expiresAt: number } | null;
};

const MINUTE = 60_000;

/** Demo ids show every state of the viewer without a backend. */
export const DEMO_RECORDS = {
  ok: 'demo-ecocardiograma',
  altered: 'demo-alterado',
  expired: 'demo-vencido',
} as const;

const DEMO_ID_SET = new Set<string>(Object.values(DEMO_RECORDS));

export const isDemoRecord = (id: string) => DEMO_ID_SET.has(id);

/**
 * e2e and demo builds can opt in to the synthetic records even with a signed-in
 * session. Never set in production: there demo ids must hit `/keys/release` like
 * any unknown record id.
 */
export { DEMO_DATA as DEMO_RECORDS_ENABLED } from '@/lib/demo';

function demoRecord(id: string, now: number): ViewerRecord {
  const base = {
    id,
    patient: { name: 'Ana Martínez', code: 'SAL-4F7K' },
    origin: { type: 'issued', by: 'Clínica del Sol' } as const,
    signedBy: 'Dr. Martín Sosa',
    uploadedAt: now - 2 * 24 * 60 * MINUTE,
  };
  if (id === DEMO_RECORDS.expired) {
    return { ...base, studyName: 'Ecocardiograma Doppler', grant: { grantedAt: now - 90 * MINUTE, expiresAt: now - 30 * MINUTE } };
  }
  return {
    ...base,
    studyName: id === DEMO_RECORDS.altered ? 'Electrocardiograma' : 'Ecocardiograma Doppler',
    grant: { grantedAt: now - 13 * MINUTE, expiresAt: now + 47 * MINUTE },
  };
}

/**
 * The study's details. Demo ids return sample data, but only in demo mode:
 * in production a synthetic id must behave like any unknown record id
 * (a real `/keys/release` 404), never render a fake "verified" study.
 * Placeholder for real ids: needs the record's metadata and the doctor's grant from the API.
 */
export async function getViewerRecord(id: string, demo: boolean): Promise<ViewerRecord | null> {
  return demo && isDemoRecord(id) ? demoRecord(id, Date.now()) : null;
}

// --- Demo file: a synthetic report, encrypted for real on every open ----------------------------

/** A one-page PDF with the given lines, built by hand so the demo needs no fixtures. Latin-1 only. */
export function buildDemoPdf(lines: { text: string; size: number; gap: number; bold?: boolean }[]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  let y = 780;
  const ops = lines
    .map((l) => {
      y -= l.gap;
      return `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf 56 ${y} Td (${esc(l.text)}) Tj ET`;
    })
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Latin-1: one byte per char, so the offsets above are byte offsets.
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0) & 0xff);
}

function demoReport(record: ViewerRecord): Uint8Array {
  return buildDemoPdf([
    { text: 'Clínica del Sol · Cardiología', size: 11, gap: 0 },
    { text: 'Informe de ecocardiograma', size: 22, gap: 34, bold: true },
    { text: `Paciente: ${record.patient.name} · Estudio sintético, no es un paciente real`, size: 11, gap: 22 },
    { text: 'Fracción de eyección: 62 %', size: 13, gap: 44 },
    { text: 'Diámetro diastólico VI: 48 mm', size: 13, gap: 26 },
    { text: 'Válvula mitral: sin alteraciones', size: 13, gap: 26 },
    { text: 'Válvula aórtica: sin alteraciones', size: 13, gap: 26 },
    { text: 'Pericardio: libre', size: 13, gap: 26 },
    { text: 'Conclusión: función sistólica conservada. Sin hallazgos patológicos.', size: 13, gap: 44 },
    { text: 'Control en 12 meses.', size: 13, gap: 20 },
    { text: `${record.signedBy} · MN 98.221`, size: 12, gap: 54, bold: true },
  ]);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Encrypts the demo report with a fresh key, like an upload would, and serves it from memory. */
function demoDeps(record: ViewerRecord): OpenDeps {
  const files = new Map<string, ArrayBuffer>();
  return {
    releaseKey: async (id): Promise<ReleasedKey> => {
      await wait(250);
      if (record.grant && record.grant.expiresAt <= Date.now()) throw new Error('API 403: grant expired');
      const dek = await generateDek();
      const plain = demoReport(record);
      const { iv, ciphertext } = await encryptFile(dek, plain.buffer as ArrayBuffer);
      const sealed = sealFile(iv, ciphertext);
      const contentHash = await sha256Hex(sealed.buffer);
      // The altered demo changes one byte after the hash was signed.
      if (id === DEMO_RECORDS.altered) sealed[sealed.length - 20] ^= 0xff;
      const url = `demo://${id}`;
      files.set(url, sealed.buffer);
      return { dek: bytesToBase64(await exportDek(dek)), download_url: url, expires_in: 60, content_hash: contentHash };
    },
    download: async (url) => {
      await wait(250);
      const file = files.get(url);
      if (!file) throw new Error('API 404: file');
      return file;
    },
  };
}

/**
 * `/keys/release` with the session's Bearer token, then the signed download URL.
 * The signed URL lives ~60 s: a storage 403 or network failure is NOT an
 * authorization problem, so it throws `unavailable` and the retry re-runs
 * `releaseKey` for a fresh URL instead of telling the reader they have no access.
 */
function apiDeps(): OpenDeps {
  const api = createApiClient();
  return {
    releaseKey: async (id): Promise<ReleasedKey> => {
      const key = await api.post<ReleasedKey>('/keys/release', { record_id: id });
      if (typeof key.expires_in !== 'number' || key.expires_in <= 0)
        throw new OpenError('unavailable');
      return key;
    },
    download: async (url) => {
      let res: Response;
      try {
        res = await fetch(url);
      } catch {
        throw new OpenError('unavailable');
      }
      if (!res.ok) throw new OpenError('unavailable');
      return res.arrayBuffer();
    },
    // The hash anchored on-chain, read from the Record account through the API.
    // Null (e.g. still pending_chain) falls back to the release hash — which
    // only proves storage integrity, not that the API served the signed hash.
    onchainHash: async (id) => {
      try {
        const res = await api.get<{ content_hash: string | null }>(
          `/records/${id}/chain-hash`,
        );
        return res.content_hash;
      } catch {
        return null;
      }
    },
  };
}

export function depsFor(id: string, record: ViewerRecord | null, demo: boolean): OpenDeps {
  return demo && record && isDemoRecord(id) ? demoDeps(record) : apiDeps();
}
