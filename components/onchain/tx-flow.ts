/**
 * The one way the app writes on-chain: the backend builds the transaction, the user signs it
 * with their Privy wallet, and the backend verifies it byte by byte, co-signs and sends it.
 * Contract: `hcd_api` `src/tx/tx-schemas.ts` and `docs/proyecto/modulo-tx.md`.
 */

import { apiCode, apiStatus } from '@/lib/api-client';

/** The user-signed instructions the app sends. `signer` is the user's own wallet. */
export type TxRequest =
  | {
      instruction: 'issue_record';
      signer: string;
      args: { patient: string; content_hash: string; storage_ref: string; superseded_record?: string | null };
    }
  | { instruction: 'grant_access'; signer: string; args: { record: string; doctor: string; expires_at: number } }
  | { instruction: 'dispute_record'; signer: string; args: { record: string } }
  | { instruction: 'revoke_access'; signer: string; args: { grant: string } }
  | { instruction: 'void_record'; signer: string; args: { record: string } };

type BuildResponse = {
  tx_id: string;
  tx_base64: string;
  message_hash: string;
  last_valid_block_height: number;
  expires_in_seconds: number;
};
type SubmitResponse = { signature: string; explorer_url: string };

export type TxPhase = 'building' | 'signing' | 'sending';

export type TxResult = { signature: string; explorerUrl: string };

export type TxDeps = {
  /** POSTs JSON to the API with the user's session token (`apiFetch` from `lib/api`) and returns the parsed body. */
  post: <T>(path: string, body: unknown) => Promise<T>;
  /** Signs a base64 transaction with the user's wallet and returns it, still base64. */
  sign: (txBase64: string) => Promise<string>;
};

export type TxErrorReason = 'session' | 'expired' | 'forbidden' | 'busy' | 'unavailable' | 'cancelled' | 'program' | 'failed';

export class TxError extends Error {
  /** For `program`: the IDL error name, e.g. `IssuerIsPatient`. */
  constructor(
    readonly reason: TxErrorReason,
    readonly programError?: string,
  ) {
    super(programError ? `tx-${reason}:${programError}` : `tx-${reason}`);
  }
}

const STATUS_REASONS: Record<number, TxErrorReason> = {
  401: 'session',
  403: 'forbidden',
  409: 'expired',
  410: 'expired', // tx_id unknown, used or expired: same rebuild-and-resign path as a dead blockhash
  429: 'busy',
  503: 'unavailable',
};

/**
 * `lib/api.ts` throws an `ApiError` with the HTTP status. A program failure is a 422 whose `code`
 * is the IDL error name; a session that can't be restored is a 503. Anything else is a generic failure.
 */
export function toTxError(err: unknown): TxError {
  if (err instanceof TxError) return err;
  const status = apiStatus(err);
  if (status === undefined) return new TxError('failed');
  if (status === 422) {
    const code = apiCode(err);
    return code && code in PROGRAM_MESSAGES ? new TxError('program', code) : new TxError('failed');
  }
  return new TxError(STATUS_REASONS[status] ?? 'failed');
}

/**
 * Builds, signs and sends one transaction. A blockhash or `tx_id` that expires while the user signs
 * (409/410) is rebuilt once, so a slow approval doesn't surface as an error.
 */
export async function runTx(request: TxRequest, deps: TxDeps, onPhase: (phase: TxPhase) => void = () => {}): Promise<TxResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      onPhase('building');
      const built = await deps.post<BuildResponse>('/tx/build', request);
      onPhase('signing');
      let signed: string;
      try {
        signed = await deps.sign(built.tx_base64);
      } catch {
        throw new TxError('cancelled');
      }
      onPhase('sending');
      const sent = await deps.post<SubmitResponse>('/tx/submit', { tx_id: built.tx_id, signed_tx_base64: signed });
      return { signature: sent.signature, explorerUrl: sent.explorer_url };
    } catch (err) {
      const error = toTxError(err);
      if (error.reason === 'expired' && attempt === 0) continue;
      throw error;
    }
  }
}

const MESSAGES: Record<Exclude<TxErrorReason, 'program'>, string> = {
  session: 'Tu sesión venció. Volvé a iniciar sesión.',
  expired: 'Tardó demasiado en firmarse. Probá de nuevo.',
  forbidden: 'Tu cuenta no puede hacer esto.',
  busy: 'Hay muchas operaciones en este momento. Probá en unos minutos.',
  unavailable: 'El servicio no responde. Probá en unos minutos.',
  cancelled: 'No se firmó. Cuando quieras, probá de nuevo.',
  failed: 'No pudimos registrarlo. Probá de nuevo.',
};

/** The program's errors (`idl/hcd.json`, 6000–6019), in words the person in front of the app can act on. */
const PROGRAM_MESSAGES: Record<string, string> = {
  Unauthorized: 'Tu cuenta no puede hacer esto.',
  ProviderNotVerified: 'Tu matrícula todavía no está verificada. Pedile a tu clínica que la avale.',
  RecordNotActive: 'Ese estudio ya no está activo.',
  RecordDisputed: 'Ese estudio está en disputa: el paciente marcó que no es suyo.',
  RecordVoided: 'Ese estudio fue anulado por quien lo emitió.',
  InvalidExpiration: 'La hora de cierre ya pasó. Elegí la duración de nuevo.',
  ExpirationTooLong: 'Ese plazo supera el máximo permitido. Elegí uno más corto.',
  GrantNotActive: 'Ese permiso ya estaba cerrado.',
  GrantExpired: 'Ese permiso ya venció.',
  NotKeyService: 'El servicio de llaves no está bien configurado. Avisale al equipo de Salua.',
  Overflow: 'No pudimos registrarlo. Probá de nuevo.',
  InvalidGrantDuration: 'El servicio no está bien configurado. Avisale al equipo de Salua.',
  InvalidOrganization: 'Tu cuenta no está bien asociada a tu clínica. Avisale al equipo de Salua.',
  NotADoctor: 'Solo un médico puede cargar estudios.',
  InvalidStorageRef: 'No pudimos registrar el archivo. Cargalo de nuevo.',
  RecordNotVoided: 'Solo se puede reemplazar un estudio anulado.',
  RecordNotDisputed: 'Solo se puede anular un estudio que el paciente marcó como «No es mío».',
  // Only `initialize_config` (admin setup) can raise this one; no app screen should ever see it.
  KeyServiceIsAdmin: 'El servicio no está bien configurado. Avisale al equipo de Salua.',
  IssuerIsPatient: 'No podés cargarte un estudio a vos mismo. Escaneá el QR del paciente.',
  InvalidContentHash: 'La huella del archivo no es válida. Volvé a cargarlo.',
};

export function txErrorMessage(err: unknown): string {
  const { reason, programError } = toTxError(err);
  if (reason === 'program') return PROGRAM_MESSAGES[programError ?? ''] ?? MESSAGES.failed;
  return MESSAGES[reason];
}
