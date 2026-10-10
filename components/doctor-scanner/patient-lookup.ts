import { QR_TTL_SECONDS, normalizeCode, parseQrPayload } from '@/components/patient-qr/qr-session';
import { apiStatus } from '@/lib/api-client';

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

export type LookupDeps = {
  /** POSTs JSON to the API with the user's session token. */
  post: <T>(path: string, body: unknown) => Promise<T>;
};

type ApiLookup = {
  patient: { name: string; member_since: string; record_count: number };
  expires_at: number;
};

/** The code both inputs end in: the QR's `c` param or the typed `SAL-XXXX`. */
function codeOf(input: CodeInput): { code: string; expiresAt?: number } | null {
  if (input.kind === 'qr') {
    const session = parseQrPayload(input.raw);
    return session ? { code: session.code, expiresAt: session.expiresAt } : null;
  }
  const code = normalizeCode(input.value);
  return code ? { code } : null;
}

/**
 * Validates a patient code and returns who it belongs to. With API deps the
 * backend resolves the code (`POST /patients/lookup`); without them the local
 * stand-in keeps demo mode and the logic tests working.
 */
export async function lookupPatient(
  input: CodeInput,
  deps?: LookupDeps,
): Promise<LookupResult> {
  const parsed = codeOf(input);
  if (!parsed) return { status: 'invalid' };
  if (parsed.expiresAt !== undefined && parsed.expiresAt <= Date.now()) {
    return { status: 'expired', code: parsed.code };
  }

  if (deps) {
    try {
      const found = await deps.post<ApiLookup>('/patients/lookup', {
        patient_code: parsed.code,
      });
      return {
        status: 'found',
        code: parsed.code,
        expiresAt: found.expires_at,
        patient: {
          name: found.patient.name,
          since: found.patient.member_since.slice(0, 4),
          studyCount: found.patient.record_count,
        },
      };
    } catch (err) {
      // 401 → session; let the shell's gate handle it. 4xx → the code did not
      // resolve (unknown, expired or already burned): same "not found" state.
      if (apiStatus(err) === 401) throw err;
      return { status: 'not-found', code: parsed.code };
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 450));
  // Demo hooks so every state can be shown without a backend.
  if (parsed.code === 'SAL-VVVV') return { status: 'expired', code: parsed.code };
  if (parsed.code === 'SAL-NNNN') return { status: 'not-found', code: parsed.code };
  return {
    status: 'found',
    code: parsed.code,
    expiresAt: parsed.expiresAt ?? Date.now() + (QR_TTL_SECONDS - 18) * 1000,
    patient: PLACEHOLDER_PATIENT,
  };
}

const PLACEHOLDER_PATIENT: ScannedPatient = { name: 'Ana Martínez', since: '2026', studyCount: 4 };
