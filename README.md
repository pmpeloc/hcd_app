# hcd_app

Salua's application: Next.js (App Router) + React + TypeScript + Tailwind +
shadcn/ui. Login with Supabase Auth, embedded Solana wallet with Privy,
WebCrypto for client-side encryption. PWA for patients.

## Routes

- `(auth)/login` - Supabase Auth (email or Google)
- `(paciente)/` - inicio, estudios, qr, accesos, linea-de-tiempo
- `(medico)/` - escanear, cargar, solicitar, visor/[recordId]
- `(clinica)/` - avalar-medicos
- `(admin)/` - verificar

## Modules

- `lib/crypto/` - AES-256-GCM + SHA-256 utilities (WebCrypto)
- `lib/hcd-client/` - program client generated with Codama from `hcd_api/idl/`
- `lib/schemas/` - Zod schemas copied by hand from `hcd_api/src/common/`
- `components/` - shadcn/ui components, viewer, watermark, QR

## Setup

```sh
cp .env.example .env   # fill in values - never commit .env
npm install
npm run dev
```

## Useful commands

```sh
npm run build     # production build
npm run lint      # ESLint
npm run test:e2e  # Playwright end-to-end tests
```

Docs (Spanish): [`../docs`](../docs). Rules: [`../AGENTS.md`](../AGENTS.md).
Only npm; never commit secrets or real patient data.

## Authentication flow

`/login` now supports Supabase email links and Google OAuth using PKCE. The
Supabase browser client restores and refreshes sessions. Open email links in
the same browser that requested them so the PKCE verifier is available.

`AuthProviders` mounts the session provider and Privy JWT synchronization. It
is currently scoped to `/login`; other screens are not protected by this PR.
The SDK subscription handles token refresh and sign-out. Before using a wallet,
the Privy custom-auth subject must match the current Supabase user. Only an
embedded Solana wallet is selected; an external or Ethereum wallet is ignored.
If no embedded wallet exists after synchronization, the app explicitly creates
one, with one in-flight request and manual retry on failure. No transaction is
signed or submitted in this flow. Sign-out clears Privy and the local Supabase
session; failures are shown so the user can retry.

Dashboard prerequisites (not changed by this PR):
- Supabase: enable email and Google, configure Google credentials, and allow
  `http://localhost:3000/login` plus the actual deployed origin's `/login` as
  redirect URLs. The email template must preserve the Supabase confirmation link.
- Privy: enable client-side JWT auth, set Supabase JWKS and the `sub` claim,
  enable embedded Solana wallets, and allow the local/deployed origins.
- Set the three public auth variables in `.env.example`. No server secret
  belongs in the app. Validating their presence does not validate dashboards.

Backend enrollment remains a separate task: create `app_user` and verify wallet
ownership server-side before binding a pubkey. Never treat this page's wallet
address as proof of ownership or assign a privileged role from client input.
Franco's tx/keys modules must apply the API auth guard and bind request identity
to the verified signer before integration. Wallet creation is not on-chain
patient registration.

Validation: `npm run lint`, `npm run build`, `npm run test:e2e -- --workers=1`.
Playwright uses synthetic Supabase responses and disables Privy; it does not
prove real email delivery, Google approval, JWT exchange with Privy or wallet
creation. Install Chromium with Playwright or set `PLAYWRIGHT_CHANNEL=msedge`
to use an installed Edge browser. Complete the live smoke test with a test
account: email/Google -> wallet -> reload -> same wallet -> sign out -> a
second account, verifying that no previous wallet is shown.

SDK integration reference:
https://docs.privy.io/authentication/user-authentication/jwt-based-auth/usage

## Authenticated API client

Use `apiFetch<T>('/tx/build', { method: 'POST', body: JSON.stringify(payload) })`.
The helper reads the current Supabase session on every request and supplies the
Bearer token automatically, including after token refresh. Do not pass a token
as the second argument anymore; there were no callers of the old signature.
Only relative API paths are accepted. Signed Storage upload URLs must use a
separate fetch without the Supabase Authorization header. Redirects are refused,
responses are not cached, and mutation requests are never retried automatically.

Catch `ApiError` to inspect `status` and the program `code` (for example
`InvalidContentHash`, `IssuerIsPatient`, or `KeyServiceIsAdmin`). Server error
messages are not exposed verbatim. This provides the transport for integration;
it does not connect the placeholder upload screens or create missing endpoints.

Run `npm run test:api` for isolated transport tests with synthetic responses.
