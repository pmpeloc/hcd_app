import { QR_TTL_SECONDS, normalizeCode, parseQrPayload } from '@/components/patient-qr/qr-session';

export type ScannedPatient = {
  name: string;
  since: string;
  studyCount: number;
};

export type LookupResult =
  | { status: 'found'; code: string; expiresAt: number; patient: ScannedPatient }
  | { status: 'expired'; code: string }
  | { status: 'invalid' }
  | { status: 'not-found'; code: string };

/** A scanned QR or a typed code, before it is validated. */
export type CodeInput = { kind: 'qr'; raw: string } | { kind: 'typed'; value: string };

/**
 * Validates a patient code and returns who it belongs to.
 * Placeholder: swap for the API call once `lib/api.ts` exposes it.
 */
export async function lookupPatient(input: CodeInput): Promise<LookupResult> {
  await new Promise((resolve) => setTimeout(resolve, 450));

  if (input.kind === 'qr') {
    const session = parseQrPayload(input.raw);
    if (!session) return { status: 'invalid' };
    if (session.expiresAt <= Date.now()) return { status: 'expired', code: session.code };
    return { status: 'found', code: session.code, expiresAt: session.expiresAt, patient: PLACEHOLDER_PATIENT };
  }

  const code = normalizeCode(input.value);
  if (!code) return { status: 'invalid' };
  // Demo hooks so every state can be shown without a backend.
  if (code === 'SAL-VVVV') return { status: 'expired', code };
  if (code === 'SAL-NNNN') return { status: 'not-found', code };
  return {
    status: 'found',
    code,
    expiresAt: Date.now() + (QR_TTL_SECONDS - 18) * 1000,
    patient: PLACEHOLDER_PATIENT,
  };
}

const PLACEHOLDER_PATIENT: ScannedPatient = { name: 'Ana Martínez', since: '2026', studyCount: 4 };
