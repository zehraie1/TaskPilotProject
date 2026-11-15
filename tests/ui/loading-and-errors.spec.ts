import { test, expect } from '../../fixtures/test.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';

/**
 * Loading and error states are made deterministic with network interception (page.route),
 * never with sleeps. Only this browser context is affected — the real API is untouched.
 */
test.describe('UI · Loading and error feedback (TP-106)', () => {
  test('loading indicator is shown while tasks load', trace({ testCase: 'TC-UI-060', covers: ['TP-106:AC1'] }), async ({ page, tasksPage }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/v1/tasks?**', async (route) => {
      await gate; // hold the response until the loading state has been asserted
      await route.continue();
    });
    await page.goto('/tasks');

    await verifyAC('TP-106:AC1', 'Loading indicator while the request is pending', '"Loading tasks…" visible, then the table', async () => {
      await expect(page.getByRole('status').filter({ hasText: 'Loading tasks…' })).toBeVisible();
      await stepScreenshot(page, 'loading state');
      release();
      await expect(tasksPage.table).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Loading tasks…' })).toHaveCount(0);
      return 'indicator shown then replaced by table';
    });
  });

  test('API unavailable shows an error with retry', trace({ testCase: 'TC-UI-061', covers: ['TP-106:AC2'], tags: ['@negative'] }), async ({ page, tasksPage }) => {
    let failing = true;
    await page.route('**/api/v1/tasks?**', (route) => (failing ? route.abort('connectionrefused') : route.continue()));
    await page.goto('/tasks');

    await verifyAC('TP-106:AC2', 'Network failure shows a clear message and "Try again"', 'error heading, message and retry button', async () => {
      await expect(tasksPage.errorState).toBeVisible();
      await expect(page.getByText('Unable to connect to the TaskPilot API.')).toBeVisible();
      await expect(tasksPage.retryButton).toBeVisible();
      await stepScreenshot(page, 'api error state', true);
      return 'Unable to connect to the TaskPilot API.';
    });
    await verifyAC('TP-106:AC2', 'Try again recovers once the API is back', 'table is shown after retry', async () => {
      failing = false;
      await tasksPage.retryButton.click();
      await expect(tasksPage.table).toBeVisible();
      return 'recovered';
    });
  });
});
