import { expect, test, type Page } from '@playwright/test';
import { signInAs } from './support/session';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Lucía Ríos');
});

async function typeCode(page: Page, code: string) {
  await page.getByLabel('¿No se puede escanear? Ingresá el código').fill(code);
  await page.getByRole('button', { name: 'Buscar' }).click();
}

test.describe('scanner', () => {
  test('finds the patient from a typed code and unlocks actions only after the ID check', async ({ page }) => {
    await page.goto('/escanear');
    await expect(page.getByText('Esperando el QR del paciente')).toBeVisible();
    await typeCode(page, 'sal 4f7k');

    await expect(page.getByText('Ana Martínez', { exact: true })).toBeVisible();
    await expect(page.getByText('SAL-4F7K · Paciente desde 2026 · 4 estudios')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cargar estudio' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Pedir acceso' })).toBeDisabled();

    const idCheck = page.getByRole('switch', { name: /Verifiqué el DNI en persona/ });
    await idCheck.click();
    await expect(idCheck).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('link', { name: 'Cargar estudio' }).last()).toHaveAttribute('href', '/cargar?paciente=SAL-4F7K');
    await expect(page.getByRole('link', { name: 'Pedir acceso' }).last()).toHaveAttribute('href', '/solicitar?paciente=SAL-4F7K');
  });

  test('explains a malformed code next to the field', async ({ page }) => {
    await page.goto('/escanear');
    await typeCode(page, 'hola');
    await expect(page.getByText('Revisá el código: tiene 4 letras o números, como SAL-4F7K.')).toBeVisible();
    await expect(page.getByLabel('¿No se puede escanear? Ingresá el código')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Esperando el QR del paciente')).toBeVisible();
  });

  test('asks for an empty code', async ({ page }) => {
    await page.goto('/escanear');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByText('Escribí el código que ve el paciente en Mi QR.')).toBeVisible();
  });

  test('shows expired and unknown codes, and lets the doctor start over', async ({ page }) => {
    await page.goto('/escanear');
    await typeCode(page, 'SAL-VVVV');
    await expect(page.getByText('El código venció', { exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Escanear de nuevo' }).click();
    await expect(page.getByText('Esperando el QR del paciente')).toBeVisible();

    await typeCode(page, 'SAL-NNNN');
    await expect(page.getByText('No encontramos ese código', { exact: true }).last()).toBeVisible();
  });
});

test.describe('study upload', () => {
  const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.alloc(4096, 1) });

  test('sends the doctor to the scanner when no patient is given', async ({ page }) => {
    await page.goto('/cargar');
    await expect(page.getByRole('heading', { name: 'Primero identificá al paciente' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Escanear QR' })).toHaveAttribute('href', '/escanear');
  });

  test('validates the study type, the file and its format', async ({ page }) => {
    await page.goto('/cargar?paciente=SAL-4F7K');
    await page.getByRole('button', { name: 'Confirmar y subir' }).click();
    await expect(page.getByText('Escribí qué estudio es.')).toBeVisible();
    await expect(page.getByText('Elegí el archivo del estudio.')).toBeVisible();

    await page.locator('input[type=file]').setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect(page.getByText('Ese formato no se puede cargar. Usá PDF, JPG, PNG o DICOM.')).toBeVisible();
  });

  test('encrypts and uploads a study, then offers to load another', async ({ page }) => {
    await page.goto('/cargar?paciente=sal4f7k');
    await page.getByLabel('Tipo de estudio').fill('Ecocardiograma Doppler');
    await page.getByRole('radio', { name: /Copia de otro centro/ }).check();
    await page.locator('input[type=file]').setInputFiles(pdf('eco.pdf'));

    const summary = page.getByRole('definition');
    await expect(summary.filter({ hasText: 'Ana Martínez · SAL-4F7K' })).toBeVisible();
    await expect(summary.filter({ hasText: 'Copia digitalizada por vos' })).toBeVisible();
    await expect(summary.filter({ hasText: 'eco.pdf · 4 KB' })).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar y subir' }).click();
    await expect(page.getByRole('button', { name: 'Subiendo…' })).toBeDisabled();
    await expect(page.getByText('Cargado')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Huella del archivo [0-9a-f]{6}…[0-9a-f]{6}/)).toBeVisible();

    await page.getByRole('button', { name: 'Cargar otro estudio' }).click();
    await expect(page.getByLabel('Tipo de estudio')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Confirmar y subir' })).toBeEnabled();
  });

  test('shows a failed upload with a retry', async ({ page }) => {
    await page.goto('/cargar?paciente=SAL-4F7K');
    await page.getByLabel('Tipo de estudio').fill('Ecocardiograma');
    await page.locator('input[type=file]').setInputFiles(pdf('estudio-error.pdf'));
    await page.getByRole('button', { name: 'Confirmar y subir' }).click();
    await expect(page.getByText('No se subió')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('El archivo no salió de tu equipo sin cifrar.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });
});
