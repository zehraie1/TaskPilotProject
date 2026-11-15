/**
 * The SAME flow as docs/codegen/recorded-create-task.raw.ts after review & refactoring:
 *  ✔ page objects instead of raw locators   ✔ baseURL from config     ✔ unique test data
 *  ✔ business assertions after every step   ✔ AC traceability         ✔ deterministic cleanup
 */
import { test, expect } from '../../fixtures/test.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { buildTask } from '../../utils/test-data.ts';

test('codegen refactor: create a high-priority task and open its details', trace({ testCase: 'TC-CG-001', covers: ['TP-101:AC4', 'TP-102:AC5'], tags: ['@codegen'] }), async ({ page, tasksPage, details, tasks }) => {
  const input = buildTask({ description: 'recorded', priority: 'high' });

  await test.step('Navigate to Tasks from the dashboard', async () => {
    await page.goto('/');
    await tasksPage.navigateTo('Tasks');
  });

  await verifyAC('TP-101:AC4', 'Create the task; it appears in the list', 'row visible', async () => {
    const form = await tasksPage.openCreateForm();
    await form.fillAndSave(input);
    await tasksPage.searchFor(input.title);
    await tasksPage.expectTaskVisible(input.title);
    await tasks.adoptByTitle(input.title);
    return 'row visible';
  });

  await verifyAC('TP-102:AC5', 'Open details; the entered values are displayed', 'title, description and priority shown', async () => {
    await tasksPage.openDetails(input.title);
    await details.expectLoaded(input.title);
    await expect(details.card).toContainText('recorded');
    await expect(details.card).toContainText('High');
    return 'details shown';
  });
});
