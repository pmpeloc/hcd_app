import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { lookupPatient } from '../components/doctor-scanner/patient-lookup';
import { checkFile, formatBytes, MAX_FILE_BYTES, uploadRecord, type UploadPhase } from '../components/doctor-upload/upload-record';
import { formatStudyDate, originLabel } from '../components/patient-studies/studies-source';
import {
  createQrSession,
  DEMO_ACCOUNT,
  encodeQrPayload,
  formatClock,
  normalizeCode,
  parseQrPayload,
  QR_TTL_SECONDS,
  secondsUntil,
  shortAccount,
} from '../components/patient-qr/qr-session';

test.describe('patient QR code', () => {
  test('issues a 2-minute code for the given account', async () => {
    const before = Date.now();
    const session = await createQrSession(DEMO_ACCOUNT);
    expect(session.account).toBe(DEMO_ACCOUNT);
    expect(session.code).toMatch(/^SAL-[A-HJ-KMNP-Z2-9]{4}$/);
    expect(session.expiresAt - before).toBeGreaterThanOrEqual(QR_TTL_SECONDS * 1000);
    expect(session.expiresAt - Date.now()).toBeLessThanOrEqual(QR_TTL_SECONDS * 1000);
  });

  test('payload round-trips through the scanner parser', () => {
    const session = { code: 'SAL-4F7K', account: DEMO_ACCOUNT, expiresAt: 1_790_000_000_000 };
    const payload = encodeQrPayload(session);
    expect(payload.startsWith('salua://qr?')).toBe(true);
    expect(parseQrPayload(payload)).toEqual(session);
  });

  test('rejects QR payloads that are not from Salua', () => {
    expect(parseQrPayload('https://example.test/?c=SAL-4F7K')).toBeNull();
    expect(parseQrPayload('salua://qr?c=SAL-4F7K')).toBeNull();
    expect(parseQrPayload('salua://qr?c=SAL-4F7K&a=x&e=soon')).toBeNull();
  });

  test('normalizes typed codes and rejects ambiguous characters', () => {
    expect(normalizeCode('4f7k')).toBe('SAL-4F7K');
    expect(normalizeCode('sal 4f7k')).toBe('SAL-4F7K');
    expect(normalizeCode(' SAL-4F7K ')).toBe('SAL-4F7K');
    expect(normalizeCode('SAL-SAL2')).toBeNull();
    expect(normalizeCode('SAL-0O1I')).toBeNull();
    expect(normalizeCode('hola')).toBeNull();
    expect(normalizeCode('')).toBeNull();
  });

  test('formats the countdown and never goes below zero', () => {
    expect(formatClock(120)).toBe('2:00');
    expect(formatClock(61)).toBe('1:01');
    expect(formatClock(9)).toBe('0:09');
    expect(secondsUntil(Date.now() - 5000)).toBe(0);
    expect(secondsUntil(Date.now() + 1500)).toBe(2);
  });

  test('shortens the account for display', () => {
    expect(shortAccount(DEMO_ACCOUNT)).toBe('7Hq3…kP2x');
    expect(shortAccount('short')).toBe('short');
  });
});

test.describe('doctor scanner lookup', () => {
  test('finds the patient from a valid scanned QR', async () => {
    const raw = encodeQrPayload({ code: 'SAL-4F7K', account: DEMO_ACCOUNT, expiresAt: Date.now() + 60_000 });
    const result = await lookupPatient({ kind: 'qr', raw });
    expect(result).toMatchObject({ status: 'found', code: 'SAL-4F7K' });
  });

  test('reports an expired scanned QR', async () => {
    const raw = encodeQrPayload({ code: 'SAL-4F7K', account: DEMO_ACCOUNT, expiresAt: Date.now() - 1000 });
    expect(await lookupPatient({ kind: 'qr', raw })).toEqual({ status: 'expired', code: 'SAL-4F7K' });
  });

  test('reports QR codes that are not from Salua', async () => {
    expect(await lookupPatient({ kind: 'qr', raw: 'https://example.test' })).toEqual({ status: 'invalid' });
  });

  test('accepts a typed code in any form', async () => {
    expect(await lookupPatient({ kind: 'typed', value: 'sal 4f7k' })).toMatchObject({ status: 'found', code: 'SAL-4F7K' });
  });
});

test.describe('study upload', () => {
  const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

  test('accepts PDF, JPG, PNG and DICOM up to 50 MB', () => {
    for (const name of ['a.pdf', 'b.JPG', 'c.jpeg', 'd.png', 'e.dcm']) expect(checkFile(file(name, 10))).toBeNull();
  });

  test('rejects other formats, empty files and files over 50 MB', () => {
    expect(checkFile(file('notes.txt', 10))).toContain('formato');
    expect(checkFile(file('scan.pdf', 0))).toContain('vacío');
    expect(checkFile(file('scan.pdf', MAX_FILE_BYTES + 1))).toContain('50 MB');
  });

  test('formats file sizes the Argentine way', () => {
    expect(formatBytes(240_000)).toBe('234 KB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2,4 MB');
  });

  test('encrypts in the browser with a fresh key and reports phases in order', async () => {
    const plaintext = new TextEncoder().encode('synthetic study, not real patient data');
    const input = {
      patientCode: 'SAL-4F7K',
      studyType: 'Ecocardiograma Doppler',
      studyDate: '2026-10-07',
      origin: 'issued' as const,
      file: new File([plaintext], 'eco.pdf'),
    };
    const phases: UploadPhase[] = [];
    const first = await uploadRecord(input, (phase) => phases.push(phase));
    const second = await uploadRecord(input, () => {});

    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    // The hash is of the ciphertext, not the plaintext, and a new key/IV changes it every time.
    expect(first.contentHash).not.toBe(createHash('sha256').update(plaintext).digest('hex'));
    expect(first.contentHash).not.toBe(second.contentHash);
    expect([...new Set(phases)]).toEqual(['encrypting', 'uploading', 'registering']);
  });

  test('fails the upload for the demo error file', async () => {
    const input = {
      patientCode: 'SAL-4F7K',
      studyType: 'Ecocardiograma',
      studyDate: '2026-10-07',
      origin: 'issued' as const,
      file: new File([new Uint8Array(10)], 'estudio-error.pdf'),
    };
    await expect(uploadRecord(input, () => {})).rejects.toThrow('upload-failed');
  });
});

test.describe('patient studies', () => {
  test('labels the origin of each study', () => {
    expect(originLabel({ type: 'issued', by: 'Centro Médico Norte' })).toBe('Emitido por Centro Médico Norte');
    expect(originLabel({ type: 'digitized', by: 'Dr. Pablo Vega' })).toBe('Copia digitalizada por Dr. Pablo Vega');
  });

  test('formats study dates', () => {
    expect(formatStudyDate('2026-09-03')).toBe('03/09/2026');
    expect(formatStudyDate('2026-09-03', 'short')).toBe('03/09');
  });
});
