import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3022', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3022',
    url: 'http://127.0.0.1:3022/login',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://salua-auth-test.invalid',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-test-key',
      NEXT_PUBLIC_PRIVY_APP_ID: '',
    },
  },
});

