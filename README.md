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
