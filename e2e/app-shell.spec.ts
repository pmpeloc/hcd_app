import { expect, test } from '@playwright/test';
import { blockAuthNetwork, signInAs } from './support/session';

test.describe('session gate', () => {
  test('asks a signed-out patient to sign in', async ({ page }) => {
    await blockAuthNetwork(page);
    await page.goto('/inicio');
    await expect(page.getByRole('heading', { name: 'Iniciá sesión para ver tu historia clínica.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
  });

  test('asks a signed-out doctor to sign in', async ({ page }) => {
    await blockAuthNetwork(page);
    await page.goto('/panel');
    await expect(page.getByRole('heading', { name: 'Iniciá sesión para atender a tus pacientes.' })).toBeVisible();
  });
});

test.describe('signed-in shell', () => {
  test('shows the patient name from the session and greets them', async ({ page }) => {
    await signInAs(page, 'Lucía Pérez');
    await page.goto('/inicio');
    await expect(page.getByRole('heading', { name: 'Hola, Lucía' })).toBeVisible();
    const account = page.getByRole('link', { name: 'Tu cuenta: Lucía Pérez' });
    await expect(account).toHaveAttribute('href', '/login');
    await expect(account).toContainText('Paciente');
  });

  test('marks the current section in the navigation', async ({ page }) => {
    await signInAs(page);
    await page.goto('/estudios');
    const nav = page.getByRole('complementary').getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Mis estudios' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current', 'page');
  });

  test('uses the session in the doctor shell', async ({ page }) => {
    await signInAs(page, 'Lucía Ríos');
    await page.goto('/panel');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Lucía');
    await expect(page.getByRole('link', { name: 'Tu cuenta: Lucía Ríos' })).toContainText('Profesional de la salud');
  });
});

test('Mi QR explains when the account cannot be prepared and offers a retry', async ({ page }) => {
  // Privy is not configured in tests, so the wallet is unavailable.
  await signInAs(page);
  await page.goto('/qr');
  await expect(page.getByRole('heading', { name: 'No pudimos preparar tu cuenta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Código QR/ })).toHaveCount(0);
});
