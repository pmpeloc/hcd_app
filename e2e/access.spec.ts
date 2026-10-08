import { expect, test, type Page } from '@playwright/test';
import { signInAs } from './support/session';

test.describe('patient access', () => {
  const request = (page: Page) => page.getByRole('region', { name: 'Decidir la solicitud de Dra. Lucía Ríos' });

  test.beforeEach(async ({ page }) => {
    await signInAs(page);
    await page.goto('/accesos');
    await expect(page.getByRole('region', { name: 'Solicitud de Dra. Lucía Ríos', exact: true })).toBeVisible();
  });

  test('shows who asks, what they can see and defaults to 24 h', async ({ page }) => {
    const from = page.getByRole('region', { name: 'Solicitud de Dra. Lucía Ríos', exact: true });
    await expect(from).toContainText('Cardióloga · MN 112.345 · Clínica del Sol');
    await expect(from).toContainText('Matrícula verificada');

    await expect(request(page).getByRole('radio', { name: '24 h' })).toHaveAttribute('aria-checked', 'true');
    await expect(request(page)).toContainText('Toda tu historia');
    await expect(request(page).getByRole('definition').filter({ hasText: /^mañana a las \d\d:\d\d$/ })).toBeVisible();
    await expect(request(page).getByRole('button', { name: 'Aprobar 24 h' })).toBeEnabled();
  });

  test('changing the duration updates the number, the closing time and the button', async ({ page }) => {
    await request(page).getByRole('radio', { name: '1 h' }).click();
    await expect(request(page).getByRole('radio', { name: '1 h' })).toHaveAttribute('aria-checked', 'true');
    await expect(request(page).getByRole('button', { name: 'Aprobar 1 h' })).toBeVisible();

    await request(page).getByRole('radio', { name: '7 días' }).click();
    await expect(request(page).getByRole('button', { name: 'Aprobar 7 días' })).toBeVisible();
    await expect(request(page).getByRole('definition').filter({ hasText: /^el \d\d\/\d\d a las \d\d:\d\d$/ })).toBeVisible();
  });

  test('approving turns the request into an active grant', async ({ page }) => {
    await request(page).getByRole('button', { name: 'Aprobar 24 h' }).click();
    await expect(page.getByRole('button', { name: 'Firmando…' })).toBeDisabled();

    const grant = page.getByRole('region', { name: 'Permiso de Dra. Lucía Ríos' });
    await expect(grant).toBeVisible();
    await expect(grant).toContainText('Le quedan 24 h.');
    await expect(grant).toContainText('Toda tu historia');
    await expect(page.getByText('No tenés solicitudes pendientes')).toBeVisible();
    await expect(page.getByText(/^Aprobaste 24 h a Dra\. Lucía Ríos\. Se cierra mañana a las/)).toBeAttached();
  });

  test('rejecting removes the request without granting anything', async ({ page }) => {
    await request(page).getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByText('No tenés solicitudes pendientes')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Permiso de Dra. Lucía Ríos' })).toHaveCount(0);
    await expect(page.getByText('Rechazaste la solicitud de Dra. Lucía Ríos.')).toBeAttached();
  });

  test('revoking asks first, then moves the grant to the history', async ({ page }) => {
    const grant = page.getByRole('region', { name: 'Permiso de Dr. Martín Sosa' });
    await expect(grant).toContainText('Le quedan 21 h.');

    await grant.getByRole('button', { name: 'Revocar' }).click();
    const dialog = page.getByRole('alertdialog', { name: '¿Revocar este permiso?' });
    await expect(dialog).toContainText('Ecografía abdominal');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(grant).toBeVisible();

    await grant.getByRole('button', { name: 'Revocar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sí, revocar' }).click();
    await expect(grant).toHaveCount(0);
    await expect(page.getByText('Nadie puede verlos ahora')).toBeVisible();

    const history = page.getByRole('region', { name: 'Permisos anteriores' });
    await expect(history.getByRole('listitem').filter({ hasText: 'Dr. Martín Sosa' })).toContainText('Revocado');
    await expect(page.getByText('Dr. Martín Sosa ya no puede ver tus estudios.')).toBeAttached();
  });

  test('lists expired and revoked grants', async ({ page }) => {
    const history = page.getByRole('region', { name: 'Permisos anteriores' });
    await expect(history.getByRole('listitem').filter({ hasText: 'Dr. Pablo Vega' })).toContainText('Vencido');
    await expect(history.getByRole('listitem').filter({ hasText: 'Dra. Inés Paz' })).toContainText('Revocado');
  });
});

test.describe('doctor access request', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'Lucía Ríos');
  });

  test('sends the doctor to the scanner when no patient is given', async ({ page }) => {
    await page.goto('/solicitar');
    await expect(page.getByRole('heading', { name: 'Primero identificá al paciente' })).toBeVisible();
    await expect(page.getByText('Después volvés acá para pedir acceso.')).toBeVisible();
  });

  test('sends a request with a reason and points to what is next', async ({ page }) => {
    await page.goto('/solicitar?paciente=sal4f7k');
    await expect(page.getByRole('region', { name: 'Paciente' })).toContainText('SAL-4F7K · Paciente desde 2026 · 4 estudios');
    await expect(page.getByRole('definition').filter({ hasText: 'Toda su historia (4 estudios)' })).toBeVisible();

    const reason = page.getByLabel('Motivo (opcional)');
    await reason.fill('Control cardiológico de hoy');
    await expect(page.getByText('27/140')).toBeVisible();

    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible();
    await expect(page.getByText('Ana la ve en su app y elige por cuánto tiempo.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver mis accesos' })).toHaveAttribute('href', '/mis-accesos');
    await expect(page.getByRole('link', { name: 'Atender a otro paciente' })).toHaveAttribute('href', '/escanear');
  });

  test('shows a failed request with a retry', async ({ page }) => {
    await page.goto('/solicitar?paciente=SAL-EEEE');
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No pudimos enviar la solicitud.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
  });
});
