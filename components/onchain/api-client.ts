import { apiFetch } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';

/** Returns the caller's current Supabase access token; Supabase refreshes it before it expires. */
export type TokenSource = () => Promise<string>;

export async function sessionToken(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || !data.session) throw new Error('API 401: no session');
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
  return {
    get: async (path) => apiFetch(path, await token()),
    post: async (path, body) => apiFetch(path, await token(), { method: 'POST', body: JSON.stringify(body) }),
  };
}
