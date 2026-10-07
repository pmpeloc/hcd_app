import { encryptFile, generateDek, sha256Hex } from '@/lib/crypto';

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
 * Encryption is real (lib/crypto, AES-256-GCM + SHA-256 of the ciphertext).
 * Upload, key deposit and the `issue_record` signature are placeholders until
 * `lib/api.ts` exposes upload-url / records and Privy can sign.
 */
export async function uploadRecord(
  input: UploadInput,
  onProgress: (phase: UploadPhase, percent: number) => void,
): Promise<UploadResult> {
  onProgress('encrypting', 5);
  const plaintext = await input.file.arrayBuffer();
  const dek = await generateDek();
  const { ciphertext } = await encryptFile(dek, plaintext);
  const contentHash = await sha256Hex(ciphertext);
  onProgress('encrypting', 25);

  // Placeholder upload of the ciphertext to the signed URL.
  for (const percent of [32, 41, 50, 60]) {
    await wait(320);
    onProgress('uploading', percent);
  }
  // Demo hook: a file named "...error..." fails here so the error state can be shown.
  if (/error/i.test(input.file.name)) throw new Error('upload-failed');

  // Placeholder for depositing the DEK in the key service and signing issue_record.
  onProgress('registering', 75);
  await wait(700);
  onProgress('registering', 90);
  await wait(400);

  return { recordId: contentHash.slice(0, 16), contentHash };
}
