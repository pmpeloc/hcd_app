import { test, expect } from '@playwright/test';
import type { User } from '@privy-io/react-auth';
import { embeddedSolanaAddress, matchesSession } from '../lib/privy';

test('wallet selection ignores external and Ethereum wallets', () => {
  const user = { linkedAccounts: [
    { type: 'wallet', chainType: 'solana', walletClientType: 'phantom', address: 'external' },
    { type: 'wallet', chainType: 'ethereum', walletClientType: 'privy', address: 'ethereum' },
    { type: 'wallet', chainType: 'solana', walletClientType: 'privy', address: 'embedded' },
    { type: 'custom_auth', customUserId: 'synthetic-user' },
  ] } as User;
  expect(embeddedSolanaAddress(user)).toBe('embedded');
  expect(matchesSession(user, 'synthetic-user')).toBe(true);
  expect(matchesSession(user, 'different-user')).toBe(false);
  expect(matchesSession(null, 'synthetic-user')).toBe(false);
  expect(embeddedSolanaAddress(null)).toBeUndefined();
});

test('requests an email link with a same-origin callback', async ({ page }) => {
  await page.route('https://salua-auth-test.invalid/**', async route => {
    expect(route.request().url()).toContain('/auth/v1/otp');
    expect(route.request().url()).toContain(encodeURIComponent('http://127.0.0.1:3022/login'));
    expect(route.request().postDataJSON().email).toBe('patient@example.test');
    await route.fulfill({ json: {} });
  });
  await page.goto('/login');
  await page.getByLabel('Email address').fill('patient@example.test');
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await expect(page.getByRole('button', { name: 'Send sign-in link' })).toBeEnabled();
});

test('shows a safe error and allows retry after an email failure', async ({ page }) => {
  await page.route('https://salua-auth-test.invalid/**', route => route.fulfill({
    status: 429, json: { message: 'internal synthetic failure', error_code: 'over_email_send_rate_limit' },
  }));
  await page.goto('/login');
  await page.getByLabel('Email address').fill('patient@example.test');
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not send');
  await expect(page.getByRole('main').getByRole('alert')).not.toContainText('internal');
  await expect(page.getByRole('button', { name: 'Send sign-in link' })).toBeEnabled();
});

test('Google login uses Supabase OAuth with a same-origin callback', async ({ page }) => {
  await page.route('https://salua-auth-test.invalid/**', route => route.fulfill({ body: 'Synthetic OAuth screen' }));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page).toHaveURL(/\/auth\/v1\/authorize\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:3022/login');
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
});

test('restores a session and signs out without a wallet service', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-salua-auth-test-auth-token', JSON.stringify({
      access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000001', email: 'patient@example.test' },
    }));
  });
  await page.route('https://salua-auth-test.invalid/**', route => route.fulfill({ status: 204, body: '' }));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Wallet service is not configured');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb-salua-auth-test-auth-token'))).toBeNull();
});


test('exchanges the PKCE callback and clears the code from the URL', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-salua-auth-test-auth-token-code-verifier', JSON.stringify('synthetic-verifier'));
  });
  await page.route('https://salua-auth-test.invalid/**', async route => {
    expect(route.request().url()).toContain('/token?grant_type=pkce');
    expect(route.request().postDataJSON()).toMatchObject({ auth_code: 'synthetic-code', code_verifier: 'synthetic-verifier' });
    await route.fulfill({ json: {
      access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: '00000000-0000-4000-8000-000000000001', email: 'patient@example.test' },
    } });
  });
  await page.goto('/login?code=synthetic-code');
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:3022/login');
});
