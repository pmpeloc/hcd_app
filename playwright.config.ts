import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // next dev compiles each route on first navigation; on slow disks that
  // outlasts the default 30 s. Retries absorb the one cold hit per route.
  timeout: 90_000,
  retries: 2,
  use: { baseURL: 'http://127.0.0.1:3022', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3022',
    url: 'http://127.0.0.1:3022/login',
    reuseExistingServer: false,
    // Dev-server cold compile on slow disks needs more than the default.
    timeout: 300000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://salua-auth-test.invalid',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-test-key',
      NEXT_PUBLIC_PRIVY_APP_ID: '',
      // Lets signed-in e2e sessions reach the demo records; never set in production.
      NEXT_PUBLIC_DEMO_RECORDS: '1',
    },
  },
});

