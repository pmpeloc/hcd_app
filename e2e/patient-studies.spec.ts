import { expect, test, type Page } from '@playwright/test';
import { signInAs } from './support/session';

const filter = (page: Page, name: RegExp) => page.getByRole('group', { name: 'Filtrar por estado' }).getByRole('button', { name });

test.beforeEach(async ({ page }) => {
  await signInAs(page);
  await page.goto('/estudios');
  await expect(page.getByText('Hemograma completo')).toBeVisible();
});

test('lists every study with its status and origin', async ({ page }) => {
  await expect(filter(page, /Todos/)).toContainText('4');
  await expect(filter(page, /Activos/)).toContainText('2');
  await expect(filter(page, /En disputa/)).toContainText('1');
  await expect(filter(page, /Anulados/)).toContainText('1');
  await expect(page.getByText('12/09/2026 · Emitido por Centro Médico Norte')).toBeVisible();
  await expect(page.getByText('21/08/2026 · Copia digitalizada por Dr. Pablo Vega')).toBeVisible();
  await expect(page.getByText('Anulado por quien lo emitió.', { exact: false })).toBeVisible();
  // Only active studies can be disputed.
  await expect(page.getByRole('button', { name: 'No es mío' })).toHaveCount(2);
});

test('filters by status', async ({ page }) => {
  await filter(page, /Anulados/).click();
  await expect(filter(page, /Anulados/)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Radiografía de tórax')).toBeVisible();
  await expect(page.getByText('Hemograma completo')).toHaveCount(0);
  await filter(page, /Todos/).click();
  await expect(page.getByText('Hemograma completo')).toBeVisible();
});

test('cancelling "No es mío" keeps the study active', async ({ page }) => {
  await page.getByRole('button', { name: 'No es mío' }).first().click();
  const dialog = page.getByRole('alertdialog', { name: '¿Este estudio no es tuyo?' });
  await expect(dialog).toContainText('Hemograma completo');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(filter(page, /Activos/)).toContainText('2');
});

test('confirming "No es mío" moves the study to disputed', async ({ page }) => {
  await page.getByRole('button', { name: 'No es mío' }).first().click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Sí, no es mío' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(filter(page, /Activos/)).toContainText('1');
  await expect(filter(page, /En disputa/)).toContainText('2');
  await expect(page.getByRole('button', { name: 'No es mío' })).toHaveCount(1);
  // Screen readers hear the change.
  await expect(page.getByText('Hemograma completo quedó en disputa.')).toBeAttached();
});
