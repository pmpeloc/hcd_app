import { defineConfig } from '@playwright/test';

// Transport tests run in Node; no browser or live backend is needed.
export default defineConfig({ testDir: './e2e', testMatch: 'api.spec.ts' });
