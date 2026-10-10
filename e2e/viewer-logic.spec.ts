import { expect, test } from '@playwright/test';
import { detectKind, openRecord, OpenError, type OpenDeps, type OpenPhase } from '../components/viewer/open-record';
import { SessionError } from '../lib/api-client';
import { base64ToBytes, bytesToBase64, IV_BYTES, openSealed, sealFile } from '../components/viewer/sealed-file';
import { buildDemoPdf } from '../components/viewer/viewer-source';
import { encryptFile, exportDek, generateDek, sha256Hex } from '../lib/crypto';

const plaintext = new TextEncoder().encode('%PDF-1.4 synthetic study, not real patient data');

/** Encrypts like an upload does and returns what storage and the key service would hold. */
async function stored() {
  const dek = await generateDek();
  const { iv, ciphertext } = await encryptFile(dek, plaintext.buffer as ArrayBuffer);
  const sealed = sealFile(iv, ciphertext);
  return { sealed, hash: await sha256Hex(sealed.buffer), dek: bytesToBase64(await exportDek(dek)) };
}

function deps(file: Uint8Array<ArrayBuffer>, hash: string, dek: string, extra: Partial<OpenDeps> = {}): OpenDeps {
  return {
    releaseKey: async () => ({ dek, download_url: 'https://storage.test/signed', expires_in: 60, content_hash: hash }),
    download: async () => file.buffer.slice(0),
    ...extra,
  };
}

test('seals the IV with the ciphertext and opens it back', async () => {
  const { sealed } = await stored();
  const { iv, ciphertext } = openSealed(sealed.buffer);
  expect(iv).toHaveLength(IV_BYTES);
  expect(ciphertext.byteLength).toBe(sealed.length - IV_BYTES);
  expect(() => openSealed(new ArrayBuffer(20))).toThrow('sealed-too-short');
  expect(base64ToBytes(bytesToBase64(sealed))).toEqual(sealed);
});

test('verifies the hash, then decrypts the original file', async () => {
  const { sealed, hash, dek } = await stored();
  const phases: OpenPhase[] = [];
  const result = await openRecord('rec-1', deps(sealed, hash, dek), (p) => phases.push(p));
  expect(phases).toEqual(['key', 'download', 'verify', 'decrypt']);
  expect(result.status).toBe('ok');
  if (result.status === 'ok') {
    expect(new Uint8Array(result.bytes)).toEqual(plaintext);
    expect(result.kind).toBe('pdf');
    expect(result.hash).toBe(hash);
  }
});

test('reports an altered file and never decrypts it', async () => {
  const { sealed, hash, dek } = await stored();
  const tampered = sealed.slice();
  tampered[tampered.length - 5] ^= 0xff;
  const phases: OpenPhase[] = [];
  const result = await openRecord('rec-1', deps(tampered, hash, dek), (p) => phases.push(p));
  expect(result).toMatchObject({ status: 'altered', expected: hash });
  expect(phases).not.toContain('decrypt');
});

test('trusts the on-chain hash over the one the key service returns', async () => {
  const { sealed, hash, dek } = await stored();
  const onchain = 'f'.repeat(64);
  const result = await openRecord('rec-1', deps(sealed, hash, dek, { onchainHash: async () => onchain }));
  expect(result).toEqual({ status: 'altered', expected: onchain, actual: hash });
});

test('turns key service answers into reasons the doctor understands', async () => {
  const { sealed, hash, dek } = await stored();
  const failing = (message: string) => deps(sealed, hash, dek, { releaseKey: () => Promise.reject(new Error(message)) });
  await expect(openRecord('rec-1', failing('API 403: no active grant'))).rejects.toMatchObject({ reason: 'no-access' });
  await expect(openRecord('rec-1', failing('API 503: log_access not confirmed'))).rejects.toMatchObject({ reason: 'unavailable' });
  await expect(openRecord('rec-1', failing('API 401: Unauthorized'))).rejects.toMatchObject({ reason: 'session' });
});

test('a session error and a storage outage keep their own reasons', async () => {
  const { sealed, hash, dek } = await stored();
  await expect(
    openRecord('rec-1', { ...deps(sealed, hash, dek), releaseKey: () => Promise.reject(new SessionError()) }),
  ).rejects.toMatchObject({ reason: 'session' });
  // A signed-URL 403 is not an authorization failure: the viewer retries by re-acquiring the key.
  await expect(
    openRecord('rec-1', { ...deps(sealed, hash, dek), download: () => Promise.reject(new OpenError('unavailable')) }),
  ).rejects.toMatchObject({ reason: 'unavailable' });
});

test('flags a file that matches its hash but not its key', async () => {
  const { sealed, hash } = await stored();
  const otherKey = bytesToBase64(await exportDek(await generateDek()));
  await expect(openRecord('rec-1', deps(sealed, hash, otherKey))).rejects.toMatchObject({ reason: 'corrupt' });
});

test('recognizes the formats a study can have', () => {
  const bytes = (...b: number[]) => new Uint8Array(b).buffer;
  expect(detectKind(new TextEncoder().encode('%PDF-1.7').buffer as ArrayBuffer)).toBe('pdf');
  expect(detectKind(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('png');
  expect(detectKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
  const dicom = new Uint8Array(132);
  dicom.set([0x44, 0x49, 0x43, 0x4d], 128);
  expect(detectKind(dicom.buffer)).toBe('dicom');
  expect(detectKind(bytes(1, 2, 3))).toBe('unknown');
});

test('builds a well-formed demo PDF', () => {
  const pdf = buildDemoPdf([{ text: 'Informe (sintético)', size: 12, gap: 0 }]);
  const text = String.fromCharCode(...pdf);
  expect(text.startsWith('%PDF-1.4')).toBe(true);
  expect(text).toContain('(Informe \\(sintético\\)) Tj');
  const xref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
  expect(text.slice(xref, xref + 4)).toBe('xref');
});
