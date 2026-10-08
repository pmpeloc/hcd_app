import { decryptFile, importDek, sha256Hex } from '@/lib/crypto';
import { base64ToBytes, openSealed } from './sealed-file';

/** `POST /keys/release` 200 body (docs/proyecto/servicio-llaves.md). */
export type ReleasedKey = { dek: string; download_url: string; expires_in: number; content_hash: string };

export type OpenDeps = {
  releaseKey: (recordId: string) => Promise<ReleasedKey>;
  download: (url: string) => Promise<ArrayBuffer>;
  /**
   * `content_hash` of the on-chain Record. Until the app can read Record accounts, the viewer falls
   * back to the hash the key service returns (read from `records`, written at issue time).
   */
  onchainHash?: (recordId: string) => Promise<string | null>;
};

export type OpenPhase = 'key' | 'download' | 'verify' | 'decrypt';

export type DocKind = 'pdf' | 'png' | 'jpeg' | 'dicom' | 'unknown';

export type OpenResult =
  | { status: 'ok'; bytes: ArrayBuffer; kind: DocKind; hash: string }
  /** The downloaded file doesn't match the signed hash. It is never decrypted. */
  | { status: 'altered'; expected: string; actual: string };

export type OpenErrorReason = 'no-access' | 'session' | 'not-found' | 'unavailable' | 'corrupt' | 'failed';

export class OpenError extends Error {
  constructor(readonly reason: OpenErrorReason) {
    super(`open-${reason}`);
  }
}

const STATUS_REASONS: Record<number, OpenErrorReason> = { 401: 'session', 403: 'no-access', 404: 'not-found', 503: 'unavailable' };

function toOpenError(err: unknown): OpenError {
  if (err instanceof OpenError) return err;
  const status = Number(/^API (\d{3})\b/.exec(err instanceof Error ? err.message : '')?.[1]);
  return new OpenError(STATUS_REASONS[status] ?? 'failed');
}

export function detectKind(bytes: ArrayBuffer): DocKind {
  const b = new Uint8Array(bytes.slice(0, 132));
  const ascii = (from: number, len: number) => String.fromCharCode(...b.slice(from, from + len));
  if (ascii(0, 5) === '%PDF-') return 'pdf';
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (ascii(128, 4) === 'DICM') return 'dicom';
  return 'unknown';
}

/**
 * Opens a study for reading: key → download → verify → decrypt.
 * The SHA-256 of the downloaded bytes is checked against the signed hash *before* decrypting;
 * on a mismatch the result is `altered` and the key is never used.
 */
export async function openRecord(recordId: string, deps: OpenDeps, onPhase: (phase: OpenPhase) => void = () => {}): Promise<OpenResult> {
  try {
    onPhase('key');
    const released = await deps.releaseKey(recordId);
    onPhase('download');
    const sealed = await deps.download(released.download_url);

    onPhase('verify');
    const actual = await sha256Hex(sealed);
    const expected = ((await deps.onchainHash?.(recordId)) ?? released.content_hash).toLowerCase();
    if (actual !== expected || released.content_hash.toLowerCase() !== expected) {
      return { status: 'altered', expected, actual };
    }

    onPhase('decrypt');
    let bytes: ArrayBuffer;
    try {
      const { iv, ciphertext } = openSealed(sealed);
      bytes = await decryptFile(await importDek(base64ToBytes(released.dek)), iv, ciphertext);
    } catch {
      // The hash matched, so the file is the signed one: a failed GCM open means a wrong key or format.
      throw new OpenError('corrupt');
    }
    return { status: 'ok', bytes, kind: detectKind(bytes), hash: actual };
  } catch (err) {
    throw toOpenError(err);
  }
}
