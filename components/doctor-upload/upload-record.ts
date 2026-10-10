import { sealFile } from '@/components/viewer/sealed-file';
import { bytesToBase64, encryptFile, exportDek, generateDek, sha256Hex } from '@/lib/crypto';
import { runTx, type TxRequest } from '@/components/onchain/tx-flow';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'dcm'];
export const ACCEPT_ATTRIBUTE = '.pdf,.jpg,.jpeg,.png,.dcm,application/pdf,image/jpeg,image/png,application/dicom';

export type StudyOrigin = 'issued' | 'digitized';

export type UploadInput = {
  patientCode: string;
  studyType: string;
  studyDate: string;
  origin: StudyOrigin;
  file: File;
};

export type UploadPhase = 'encrypting' | 'uploading' | 'registering';

export type UploadResult = {
  recordId: string;
  contentHash: string;
  /** Solana devnet explorer link for the anchored `issue_record` (real uploads only). */
  explorerUrl?: string;
};

export type UploadDeps = {
  /** POSTs JSON to the API with the user's session token. */
  post: <T>(path: string, body: unknown) => Promise<T>;
  /** Signs a base64 transaction with the user's wallet and returns it, still base64. */
  sign: (txBase64: string) => Promise<string>;
};

type UploadUrlResponse = {
  record_id: string;
  upload_token: string;
  upload_url: string;
};

type CreateRecordResponse = {
  record_id: string;
  status: 'pending_chain';
  build_request: TxRequest;
};

/** Returns an error message, or `null` when the file can be uploaded. */
export function checkFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ACCEPTED_EXTENSIONS.includes(extension)) return 'Ese formato no se puede cargar. Usá PDF, JPG, PNG o DICOM.';
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > MAX_FILE_BYTES) return 'El archivo pesa más de 50 MB.';
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Encrypts the study in the browser and hands it to the backend.
 * Encryption is real (lib/crypto, AES-256-GCM). What gets stored is the sealed file,
 * `iv || ciphertext` (components/viewer/sealed-file.ts), and `contentHash` is its SHA-256.
 * With API deps the full flow runs: upload-url → PUT the sealed blob → register
 * the DEK → the doctor signs `issue_record`. Without them the placeholder path
 * keeps demo mode and the logic tests working.
 */
export async function uploadRecord(
  input: UploadInput,
  onProgress: (phase: UploadPhase, percent: number) => void,
  deps?: UploadDeps,
): Promise<UploadResult> {
  onProgress('encrypting', 5);
  const plaintext = await input.file.arrayBuffer();
  const dek = await generateDek();
  const { iv, ciphertext } = await encryptFile(dek, plaintext);
  const sealed = sealFile(iv, ciphertext);
  const contentHash = await sha256Hex(sealed.buffer);
  onProgress('encrypting', 25);

  if (!deps) {
    // Placeholder upload of the sealed file to the signed URL.
    for (const percent of [32, 41, 50, 60]) {
      await wait(320);
      onProgress('uploading', percent);
    }
    // Demo hook: a file named "...error..." fails here so the error state can be shown.
    if (/error/i.test(input.file.name)) throw new Error('upload-failed');

    onProgress('registering', 75);
    await wait(700);
    onProgress('registering', 90);
    await wait(400);

    return { recordId: contentHash.slice(0, 16), contentHash };
  }

  onProgress('uploading', 32);
  const reservation = await deps.post<UploadUrlResponse>('/records/upload-url', {
    patient_code: input.patientCode,
    content_hash: contentHash,
    ciphertext_bytes: sealed.byteLength,
    title: input.studyType,
    study_date: input.studyDate,
    origin: input.origin,
  });
  onProgress('uploading', 45);
  // The signed URL is absolute and needs no auth header — it IS the credential.
  const stored = await fetch(reservation.upload_url, {
    method: 'PUT',
    body: sealed.buffer as ArrayBuffer,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!stored.ok) throw new Error(`storage ${stored.status}`);
  onProgress('uploading', 60);

  onProgress('registering', 75);
  const created = await deps.post<CreateRecordResponse>('/records', {
    upload_token: reservation.upload_token,
    dek: bytesToBase64(await exportDek(dek)),
    encryption_iv: bytesToBase64(iv),
  });
  onProgress('registering', 85);
  const tx = await runTx(created.build_request, deps, () => {});
  onProgress('registering', 95);

  return { recordId: created.record_id, contentHash, explorerUrl: tx.explorerUrl };
}
