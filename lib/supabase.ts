import { createClient } from '@supabase/supabase-js';

// Login lives in Supabase Auth (email + Google). The resulting token is sent
// to the API on every request and is what RLS uses to isolate organizations.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
