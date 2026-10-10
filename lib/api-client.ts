export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | undefined>;
  fetcher?: typeof fetch;
}

/** Authenticated JSON transport. Never use it for third-party signed upload URLs. */
export function createApiClient({ baseUrl, getAccessToken, fetcher = fetch }: ApiClientOptions) {
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
    catch { throw new ApiError(503, 'Could not restore your session. Please try again.'); }
    if (!token || /\s/.test(token)) throw new ApiError(401, 'Please sign in to continue.');

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

