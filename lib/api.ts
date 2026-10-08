import { createApiClient } from './api-client';
import { getSupabaseClient } from './supabase';

export { ApiError } from './api-client';

/** Reads the current Supabase session for every call, including refreshed tokens. */
export const apiFetch = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  getAccessToken: async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw error;
    return data.session?.access_token;
  },
});
