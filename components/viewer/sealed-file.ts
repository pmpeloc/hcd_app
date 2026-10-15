/**
 * The bytes stored for a study: `iv(12) || AES-256-GCM ciphertext (with its 16-byte tag)`.
 * `/keys/release` returns the key but not the file's IV, so the IV travels with the file, the same
 * layout the key service uses for `records.wrapped_dek`. `content_hash` is the SHA-256 of these
 * exact bytes: what gets downloaded is what gets checked.
 */
export const IV_BYTES = 12;
const TAG_BYTES = 16;

export function sealFile(iv: Uint8Array, ciphertext: ArrayBuffer): Uint8Array<ArrayBuffer> {
  const sealed = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  sealed.set(iv, 0);
  sealed.set(new Uint8Array(ciphertext), IV_BYTES);
  return sealed;
}

export function openSealed(sealed: ArrayBuffer): { iv: Uint8Array; ciphertext: ArrayBuffer } {
  if (sealed.byteLength < IV_BYTES + TAG_BYTES) throw new Error('sealed-too-short');
  return { iv: new Uint8Array(sealed.slice(0, IV_BYTES)), ciphertext: sealed.slice(IV_BYTES) };
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
