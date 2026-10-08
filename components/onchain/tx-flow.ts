/**
 * The one way the app writes on-chain: the backend builds the transaction, the user signs it
 * with their Privy wallet, and the backend verifies it byte by byte, co-signs and sends it.
 * Contract: `hcd_api` `src/tx/tx-schemas.ts` and `docs/proyecto/modulo-tx.md`.
 */

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

type BuildResponse = { tx_id: string; tx_base64: string; message_hash: string; expires_in_slots: number };
type SubmitResponse = { signature: string; explorer_url: string };

export type TxPhase = 'building' | 'signing' | 'sending';

export type TxResult = { signature: string; explorerUrl: string };

export type TxDeps = {
  /** POSTs JSON to the API with the user's session token and returns the parsed body. */
  post: <T>(path: string, body: unknown) => Promise<T>;
  /** Signs a base64 transaction with the user's wallet and returns it, still base64. */
  sign: (txBase64: string) => Promise<string>;
};

export type TxErrorReason = 'expired' | 'forbidden' | 'busy' | 'unavailable' | 'cancelled' | 'failed';

export class TxError extends Error {
  constructor(readonly reason: TxErrorReason) {
    super(`tx-${reason}`);
  }
}

const STATUS_REASONS: Record<number, TxErrorReason> = { 403: 'forbidden', 409: 'expired', 429: 'busy', 503: 'unavailable' };

/** `lib/api.ts` throws `API <status>: <body>`; anything else is treated as a generic failure. */
function toTxError(err: unknown): TxError {
  if (err instanceof TxError) return err;
  const status = Number(/^API (\d{3})\b/.exec(err instanceof Error ? err.message : '')?.[1]);
  return new TxError(STATUS_REASONS[status] ?? 'failed');
}

/**
 * Builds, signs and sends one transaction. A blockhash that expires while the user signs
 * (409) is rebuilt once, so a slow approval doesn't surface as an error.
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

const MESSAGES: Record<TxErrorReason, string> = {
  expired: 'Tardó demasiado en firmarse. Probá de nuevo.',
  forbidden: 'Tu cuenta no puede hacer esto.',
  busy: 'Hay muchas operaciones en este momento. Probá en unos minutos.',
  unavailable: 'La red de Solana no responde. Probá en unos minutos.',
  cancelled: 'No se firmó. Cuando quieras, probá de nuevo.',
  failed: 'No pudimos registrarlo. Probá de nuevo.',
};

export function txErrorMessage(err: unknown): string {
  return MESSAGES[toTxError(err).reason];
}
