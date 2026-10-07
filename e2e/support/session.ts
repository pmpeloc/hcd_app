import type { Page } from '@playwright/test';

// Matches NEXT_PUBLIC_SUPABASE_URL in playwright.config.ts (https://salua-auth-test.invalid).
const STORAGE_KEY = 'sb-salua-auth-test-auth-token';

/**
 * Starts the page with a stored Supabase session for a synthetic user, the same
 * way the login tests restore one. Privy is not configured in tests, so the
 * wallet reports "not configured".
 */
export async function signInAs(page: Page, fullName = 'Ana Martínez') {
  await page.addInitScript(
    ({ key, name }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: 'synthetic-token',
          refresh_token: 'synthetic-refresh',
          token_type: 'bearer',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            email: 'patient@example.test',
            user_metadata: { full_name: name },
          },
        }),
      );
    },
    { key: STORAGE_KEY, name: fullName },
  );
  await blockAuthNetwork(page);
}

/** The synthetic Supabase host never resolves; answer it so nothing hangs. */
export async function blockAuthNetwork(page: Page) {
  await page.route('https://salua-auth-test.invalid/**', (route) => route.fulfill({ status: 204, body: '' }));
}
