// WebCrypto utilities for client-side encryption of health records.
// AES-256-GCM with a random DEK per record, a unique IV per file and
// SHA-256 of the ciphertext for on-chain integrity (Record.content_hash).
// Owner: Franco - see docs/tareas/franco.md.

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96-bit nonce, recommended for AES-GCM

export interface EncryptedFile {
  ciphertext: ArrayBuffer;
  iv: Uint8Array;
}

/** Random 256-bit AES-GCM key; one per record. */
export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptFile(
  dek: CryptoKey,
  plaintext: ArrayBuffer,
): Promise<EncryptedFile> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    dek,
    plaintext,
  );
  return { ciphertext, iv };
}

export async function decryptFile(
  dek: CryptoKey,
  iv: Uint8Array,
  ciphertext: ArrayBuffer,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as BufferSource },
    dek,
    ciphertext,
  );
}

/** Hex SHA-256 of the ciphertext; must match Record.content_hash on-chain. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// The DEK travels over TLS to the key service as raw bytes; the service
// stores only the wrapped (KEK-encrypted) version and releases it back
// to authorized readers.
export async function exportDek(dek: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', dek));
}

export async function importDek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as BufferSource,
    { name: ALGORITHM, length: 256 },
    false,
    ['decrypt'],
  );
}

/** Standard padded base64 — the encoding the API expects for DEK and IV. */
export function bytesToBase64(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
