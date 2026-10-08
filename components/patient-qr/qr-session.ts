export const QR_TTL_SECONDS = 120;

export type QrSession = {
  /** Short one-time code the patient can read aloud, e.g. `SAL-4F7K`. */
  code: string;
  /** Patient's public account address. Never shown as "wallet" in the UI. */
  account: string;
  /** Epoch milliseconds when the code stops being valid. */
  expiresAt: number;
};

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PAYLOAD_PREFIX = 'salua://qr';

/** Synthetic devnet-style address, used only in demo mode (auth not configured). */
export const DEMO_ACCOUNT = '7Hq3fN2xQeLzR8vWbK5mYtC9pDsJ4aGuE6hVnXo1kP2x';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `SAL-${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')}`;
}

/**
 * Issues a new one-time code for the patient's account (their Privy wallet).
 * The code is generated in the browser for now; once the API exposes it, the
 * backend should issue and remember it so the doctor's scanner can validate it.
 */
export async function createQrSession(account: string): Promise<QrSession> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return {
    code: randomCode(),
    account,
    expiresAt: Date.now() + QR_TTL_SECONDS * 1000,
  };
}

export function encodeQrPayload({ code, account, expiresAt }: QrSession): string {
  const params = new URLSearchParams({ c: code, a: account, e: String(Math.floor(expiresAt / 1000)) });
  return `${PAYLOAD_PREFIX}?${params}`;
}

/** Reads a scanned payload. Returns `null` when it is not a Salua code. */
export function parseQrPayload(raw: string): QrSession | null {
  if (!raw.startsWith(`${PAYLOAD_PREFIX}?`)) return null;
  const params = new URLSearchParams(raw.slice(PAYLOAD_PREFIX.length + 1));
  const code = params.get('c');
  const account = params.get('a');
  const expires = Number(params.get('e'));
  if (!code || !account || !Number.isFinite(expires)) return null;
  return { code, account, expiresAt: expires * 1000 };
}

const CODE_PATTERN = new RegExp(`^SAL-[${CODE_ALPHABET}]{4}$`);

/** Normalizes a typed code (`sal 4f7k`, `4F7K`) to `SAL-4F7K`. Returns `null` when it can't be a code. */
export function normalizeCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = compact.length > 4 && compact.startsWith('SAL') ? compact.slice(3) : compact;
  const code = `SAL-${body}`;
  return CODE_PATTERN.test(code) ? code : null;
}

export function secondsUntil(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function shortAccount(account: string): string {
  return account.length > 10 ? `${account.slice(0, 4)}…${account.slice(-4)}` : account;
}
