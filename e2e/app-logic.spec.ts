import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  effectiveStatus,
  expiryFor,
  formatAgo,
  formatCloses,
  formatRemaining,
  grantProgress,
  requestAccess,
  type Grant,
} from '../components/access/access-source';
import { lookupPatient } from '../components/doctor-scanner/patient-lookup';
import { checkFile, formatBytes, MAX_FILE_BYTES, uploadRecord, type UploadPhase } from '../components/doctor-upload/upload-record';
import { createApiClient } from '../components/onchain/api-client';
import { runTx, toTxError, TxError, txErrorMessage, type TxDeps, type TxPhase, type TxRequest } from '../components/onchain/tx-flow';
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

test.describe('on-chain transactions', () => {
  const request: TxRequest = { instruction: 'dispute_record', signer: 'PatientWallet111', args: { record: 'RecordPda111' } };
  const built = { tx_id: '6f1c2a40-0000-4000-8000-000000000001', tx_base64: 'dW5zaWduZWQ=', message_hash: 'ab', expires_in_slots: 150 };
  const sent = { signature: '5sig', explorer_url: 'https://explorer.solana.com/tx/5sig?cluster=devnet' };

  /** A fake API: each call to a path shifts the next scripted response (or error) for it. */
  function fakeApi(script: Record<string, (object | Error)[]>) {
    const calls: { path: string; body: unknown }[] = [];
    const post: TxDeps['post'] = async <T,>(path: string, body: unknown) => {
      calls.push({ path, body });
      const next = script[path].shift();
      if (next instanceof Error) throw next;
      return next as T;
    };
    return { post, calls };
  }

  test('builds, signs with the wallet and submits, reporting each phase', async () => {
    const api = fakeApi({ '/tx/build': [built], '/tx/submit': [sent] });
    const phases: TxPhase[] = [];
    const result = await runTx(request, { post: api.post, sign: async (tx) => `signed:${tx}` }, (p) => phases.push(p));

    expect(result).toEqual({ signature: '5sig', explorerUrl: sent.explorer_url });
    expect(phases).toEqual(['building', 'signing', 'sending']);
    expect(api.calls).toEqual([
      { path: '/tx/build', body: request },
      { path: '/tx/submit', body: { tx_id: built.tx_id, signed_tx_base64: 'signed:dW5zaWduZWQ=' } },
    ]);
  });

  test('rebuilds once when the blockhash expired while signing', async () => {
    const api = fakeApi({ '/tx/build': [built, built], '/tx/submit': [new Error('API 409: blockhash expired'), sent] });
    await expect(runTx(request, { post: api.post, sign: async (tx) => tx })).resolves.toMatchObject({ signature: '5sig' });
    expect(api.calls.map((c) => c.path)).toEqual(['/tx/build', '/tx/submit', '/tx/build', '/tx/submit']);
  });

  test('gives up after a second expiry', async () => {
    const expired = () => new Error('API 409: blockhash expired');
    const api = fakeApi({ '/tx/build': [built, built], '/tx/submit': [expired(), expired()] });
    await expect(runTx(request, { post: api.post, sign: async (tx) => tx })).rejects.toMatchObject({ reason: 'expired' });
  });

  test('treats a rejected wallet prompt as cancelled and never submits', async () => {
    const api = fakeApi({ '/tx/build': [built], '/tx/submit': [sent] });
    const sign = async () => {
      throw new Error('User rejected the request');
    };
    await expect(runTx(request, { post: api.post, sign })).rejects.toMatchObject({ reason: 'cancelled' });
    expect(api.calls.map((c) => c.path)).toEqual(['/tx/build']);
  });

  test('maps API errors to messages the user can act on', async () => {
    expect(txErrorMessage(new Error('API 429: budget exhausted'))).toContain('muchas operaciones');
    expect(txErrorMessage(new Error('API 503: rpc down'))).toContain('Solana no responde');
    expect(txErrorMessage(new Error('API 403: forbidden'))).toBe('Tu cuenta no puede hacer esto.');
    expect(txErrorMessage(new TxError('cancelled'))).toContain('No se firmó');
    expect(txErrorMessage(new Error('Failed to fetch'))).toBe('No pudimos registrarlo. Probá de nuevo.');
  });
});

test.describe('API client', () => {
  type Seen = { url: string; auth: string | null; method?: string; body?: unknown };

  async function withFetch(response: () => Response, run: (seen: Seen[]) => Promise<void>) {
    const seen: Seen[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), auth: new Headers(init?.headers).get('Authorization'), method: init?.method, body: init?.body });
      return response();
    };
    try {
      await run(seen);
    } finally {
      globalThis.fetch = real;
    }
  }

  test('sends the session token as a Bearer header, read fresh on every call', async () => {
    let n = 0;
    const api = createApiClient(async () => `token-${++n}`);
    await withFetch(
      () => new Response('{"ok":true}', { status: 200 }),
      async (seen) => {
        await expect(api.post('/tx/build', { instruction: 'x' })).resolves.toEqual({ ok: true });
        await api.get('/access-requests/mine');
        expect(seen[0]).toMatchObject({ auth: 'Bearer token-1', method: 'POST', body: '{"instruction":"x"}' });
        expect(seen[0].url.endsWith('/tx/build')).toBe(true);
        expect(seen[1]).toMatchObject({ auth: 'Bearer token-2' });
      },
    );
  });

  test('turns a 401 into "session expired" for the user', async () => {
    const api = createApiClient(async () => 'stale');
    await withFetch(
      () => new Response('Unauthorized', { status: 401 }),
      async () => {
        const err = await api.post('/tx/build', {}).catch((e: unknown) => e);
        expect(toTxError(err).reason).toBe('session');
        expect(txErrorMessage(err)).toBe('Tu sesión venció. Volvé a iniciar sesión.');
      },
    );
  });
});

test.describe('program errors', () => {
  const programError = (code: string) =>
    new Error(`API 422: ${JSON.stringify({ statusCode: 422, code, message: 'from the IDL' })}`);

  test('explain the three new program errors', () => {
    expect(txErrorMessage(programError('IssuerIsPatient'))).toBe('No podés cargarte un estudio a vos mismo. Escaneá el QR del paciente.');
    expect(txErrorMessage(programError('InvalidContentHash'))).toBe('La huella del archivo no es válida. Volvé a cargarlo.');
    expect(txErrorMessage(programError('KeyServiceIsAdmin'))).toContain('Avisale al equipo de Salua');
  });

  test('explain the errors a patient or doctor can actually hit', () => {
    expect(txErrorMessage(programError('ProviderNotVerified'))).toContain('matrícula todavía no está verificada');
    expect(txErrorMessage(programError('RecordDisputed'))).toContain('en disputa');
    expect(txErrorMessage(programError('GrantExpired'))).toBe('Ese permiso ya venció.');
    expect(toTxError(programError('NotADoctor'))).toMatchObject({ reason: 'program', programError: 'NotADoctor' });
  });

  test('fall back to a generic message for unknown or non-JSON failures', () => {
    expect(toTxError(programError('error_6099')).reason).toBe('failed');
    expect(toTxError(new Error('API 422: transaction failed: blockhash not found')).reason).toBe('failed');
    expect(txErrorMessage(programError('error_6099'))).toBe('No pudimos registrarlo. Probá de nuevo.');
  });

  test('are not retried by runTx', async () => {
    let builds = 0;
    const post: TxDeps['post'] = async <T,>(path: string) => {
      if (path === '/tx/build') {
        builds++;
        return { tx_id: '6f1c2a40-0000-4000-8000-000000000001', tx_base64: 'eA==', message_hash: 'ab', expires_in_slots: 150 } as T;
      }
      throw programError('IssuerIsPatient');
    };
    const request: TxRequest = { instruction: 'void_record', signer: 'Doctor111', args: { record: 'Rec111' } };
    await expect(runTx(request, { post, sign: async (tx) => tx })).rejects.toMatchObject({ reason: 'program', programError: 'IssuerIsPatient' });
    expect(builds).toBe(1);
  });
});

test.describe('access grants', () => {
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  test('shows the time left in the unit read at a glance', () => {
    expect(formatRemaining(24 * HOUR - 2000)).toEqual({ value: 24, unit: 'h' });
    expect(formatRemaining(21 * HOUR)).toEqual({ value: 21, unit: 'h' });
    expect(formatRemaining(45 * MIN)).toEqual({ value: 45, unit: 'min' });
    expect(formatRemaining(59.9 * MIN)).toEqual({ value: 1, unit: 'h' });
    expect(formatRemaining(10_000)).toEqual({ value: 1, unit: 'min' });
    expect(formatRemaining(7 * DAY - MIN)).toEqual({ value: 7, unit: 'días' });
    expect(formatRemaining(-5)).toEqual({ value: 0, unit: 'min' });
  });

  test('says when a grant closes in local time', () => {
    const now = new Date(2026, 9, 8, 14, 13).getTime();
    expect(formatCloses(new Date(2026, 9, 8, 15, 13).getTime(), now)).toBe('hoy a las 15:13');
    expect(formatCloses(expiryFor('24h', now), now)).toBe('mañana a las 14:13');
    expect(formatCloses(expiryFor('7d', now), now)).toBe('el 15/10 a las 14:13');
  });

  test('turns the chosen duration into an expiry', () => {
    expect(expiryFor('1h', 0)).toBe(HOUR);
    expect(expiryFor('24h', 0)).toBe(DAY);
    expect(expiryFor('7d', 0)).toBe(7 * DAY);
  });

  test('tracks how much of the grant is left and when it lapses', () => {
    const grant = { grantedAt: 0, expiresAt: 24 * HOUR } as Grant;
    expect(grantProgress(grant, 3 * HOUR)).toBeCloseTo(0.875);
    expect(grantProgress(grant, 30 * HOUR)).toBe(0);
    expect(effectiveStatus({ ...grant, status: 'active' }, 23 * HOUR)).toBe('active');
    expect(effectiveStatus({ ...grant, status: 'active' }, 24 * HOUR)).toBe('expired');
    expect(effectiveStatus({ ...grant, status: 'revoked' }, HOUR)).toBe('revoked');
  });

  test('says how long ago a request arrived', () => {
    expect(formatAgo(0, 30_000)).toBe('Recién');
    expect(formatAgo(0, 12 * MIN)).toBe('Hace 12 min');
    expect(formatAgo(0, 3 * HOUR)).toBe('Hace 3 h');
    expect(formatAgo(0, DAY + HOUR)).toBe('Ayer');
    expect(formatAgo(0, 4 * DAY)).toBe('Hace 4 días');
  });

  test('fails the request for the demo error code', async () => {
    await expect(requestAccess({ patientCode: 'SAL-EEEE', reason: '' })).rejects.toThrow('request-failed');
    await expect(requestAccess({ patientCode: 'SAL-4F7K', reason: 'control' })).resolves.toEqual({ id: 'req-sal-4f7k' });
  });
});
