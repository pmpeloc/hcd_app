// Thin entry point to the Salua API. Every request carries the Supabase Auth
// token so the backend can verify it and RLS can isolate rows.
export { apiFetch, ApiError } from './api-client';
