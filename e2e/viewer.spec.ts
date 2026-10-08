import { expect, test } from '@playwright/test';
import { signInAs } from './support/session';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Lucía Ríos');
});

test('lists the studies the doctor can open', async ({ page }) => {
  await page.goto('/mis-accesos');
  await expect(page.getByRole('link', { name: /Ecocardiograma Doppler.*47 min/ })).toHaveAttribute('href', '/visor/demo-ecocardiograma');
  await expect(page.getByRole('link', { name: /Electrocardiograma/ })).toHaveAttribute('href', '/visor/demo-alterado');
  await expect(page.getByRole('link', { name: /Se cerró/ })).toHaveAttribute('href', '/visor/demo-vencido');
});

test('opens a verified study on a watermarked canvas, without download', async ({ page }) => {
  await page.goto('/visor/demo-ecocardiograma');
  await expect(page.getByRole('img', { name: 'Ecocardiograma Doppler, página 1 de 1' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Integridad del estudio' })).toContainText('Es el archivo original');
  await expect(page.getByText('Estudio verificado y abierto.')).toBeAttached();

  const time = page.getByRole('region', { name: 'Tiempo restante' });
  await expect(time).toContainText('Te quedan');
  await expect(time).toContainText(/Ana te dio 1 h\. Se cierra hoy a las \d\d:\d\d\./);
  await expect(page.getByRole('region', { name: 'Origen' })).toContainText('Clínica del Sol');
  await expect(page.getByText('Solo lectura · sin descarga')).toBeVisible();

  // Nothing on the page hands the file out.
  await expect(page.getByRole('link', { name: /descarg/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /descarg/i })).toHaveCount(0);
  await expect(page.locator('a[download], a[href^="blob:"], embed, iframe, object')).toHaveCount(0);

  // The canvas holds real, non-blank pixels.
  const inked = await page
    .locator('canvas')
    .first()
    .evaluate((c: HTMLCanvasElement) => {
      const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 100) dark++;
      return dark;
    });
  expect(inked).toBeGreaterThan(500);
});

test('shows "Estudio alterado" and never draws the document', async ({ page }) => {
  await page.goto('/visor/demo-alterado');
  await expect(page.getByRole('alert').filter({ hasText: 'Estudio alterado' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('No lo desciframos', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Integridad del estudio' })).toContainText('Este archivo cambió después de firmarse.');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('an expired grant shows nothing and offers to ask again', async ({ page }) => {
  await page.goto('/visor/demo-vencido');
  await expect(page.getByRole('heading', { name: 'Tu permiso venció' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Tiempo restante' })).toContainText('Permiso vencido');
  await expect(page.getByRole('main').getByRole('link', { name: 'Pedir acceso' })).toHaveAttribute('href', '/solicitar?paciente=SAL-4F7K');
  await expect(page.locator('canvas')).toHaveCount(0);
});
