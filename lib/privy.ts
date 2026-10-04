// Privy is used only for the embedded Solana wallet, in "custom auth" mode:
// it receives the Supabase Auth token and creates the wallet. The app secret
// lives only in the API; the app id is public.
// See docs/proyecto/decisiones.md and the 1-hour test in docs/proyecto/stack.md.
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
