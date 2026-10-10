import { getSupabaseClient } from '@/lib/supabase';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The caller has no usable session. Dedicated type so callers do not sniff
 * `'API 401: no session'` out of an error string (spoofable). It is also a
 * 401 ApiError, so status-based handling treats it the same way.
 */
export class SessionError extends ApiError {
  constructor() {
    super(401, 'Please sign in to continue.');
    this.name = 'SessionError';
  }
}

/**
 * HTTP status of a failed API call: an ApiError, or a synthetic
 * `API <status>: <body>` Error (demo paths and tests build those).
 */
export function apiStatus(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.status;
  const match = /^API (\d{3})\b/.exec(err instanceof Error ? err.message : '');
  return match ? Number(match[1]) : undefined;
}

/** Program error code (`InvalidContentHash`, …) carried by a 422. */
export function apiCode(err: unknown): string | undefined {
  if (err instanceof ApiError) return err.code;
  const body = /^API \d{3}: ?([\s\S]*)$/.exec(err instanceof Error ? err.message : '')?.[1];
  try {
    const code = (JSON.parse(body ?? '') as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  } catch {
    return undefined;
  }
}

interface ApiTransportOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | undefined>;
  fetcher?: typeof fetch;
}

/** Authenticated JSON transport. Never use it for third-party signed upload URLs. */
export function createApiTransport({ baseUrl, getAccessToken, fetcher = (input, init) => fetch(input, init) }: ApiTransportOptions) {
  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!baseUrl) throw new ApiError(0, 'The API is not configured.');
    let url: URL;
    try {
      const base = new URL(baseUrl);
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
        || base.search || base.hash || !path.startsWith('/') || path.startsWith('//')
        || /[\\\r\n]/.test(path)) throw new Error('Invalid API URL');
      url = new URL(`${baseUrl.replace(/\/$/, '')}${path}`);
      if (url.origin !== base.origin) throw new Error('Invalid API origin');
    } catch { throw new ApiError(0, 'Invalid API request URL.'); }

    let token: string | undefined;
    try { token = await getAccessToken(); }
    catch (err) {
      if (err instanceof SessionError) throw err;
      throw new ApiError(503, 'Could not restore your session. Please try again.');
    }
    if (!token || /\s/.test(token)) throw new SessionError();

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    // Do not forward JWTs through redirects, cache responses, or retry mutations.
    const response = await fetcher(url.toString(), {
      ...init, headers, redirect: 'error', credentials: 'omit', cache: 'no-store',
    });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => undefined);
      const code = payload && typeof payload === 'object' && 'code' in payload
        && typeof payload.code === 'string' ? payload.code : undefined;
      const messages: Record<number, string> = {
        401: 'Your session is no longer valid. Please sign in again.',
        403: 'You do not have permission for this action.',
        410: 'This transaction has expired or was already used.',
        422: 'The request was rejected. Check the submitted information.',
        429: 'Too many requests. Please wait before trying again.',
      };
      throw new ApiError(response.status, messages[response.status] ?? 'The request could not be completed.', code);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };
}

// Read per call (Next inlines the literal at build time; tests set it at runtime).
const apiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? '';

/** One authenticated call with an explicit token. */
export function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return createApiTransport({ baseUrl: apiUrl(), getAccessToken: async () => token })<T>(path, init);
}

/** Returns the caller's current Supabase access token; Supabase refreshes it before it expires. */
export type TokenSource = () => Promise<string>;

export async function sessionToken(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || !data.session) throw new SessionError();
  return data.session.access_token;
}

export type ApiClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
};

/**
 * Every call to the Salua API goes through here, so each one carries `Authorization: Bearer <token>`
 * (`/tx` and `/keys` reject anything else with 401). The token is read per call, never cached.
 */
export function createApiClient(token: TokenSource = sessionToken): ApiClient {
  const request = createApiTransport({ baseUrl: apiUrl(), getAccessToken: token });
  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  };
}
