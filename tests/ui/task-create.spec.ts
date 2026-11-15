import { test, expect } from '../../fixtures/test.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { PRIORITY_LABEL, STATUS_LABEL, buildTask, displayDate, isoDate } from '../../utils/test-data.ts';

test.describe('UI · Create task (TP-101)', () => {
  test('create a task through the form', trace({ testCase: 'TC-UI-010', covers: ['TP-101:AC3', 'TP-101:AC4'], tags: ['@smoke'] }), async ({ page, tasksPage, tasks }) => {
    const input = buildTask({ priority: 'high', status: 'in_progress', due_date: isoDate(10) });
    await tasksPage.goto();

    const form = await test.step('Open the create dialog', async () => {
      const f = await tasksPage.openCreateForm();
      await expect(f.status).toHaveValue('pending'); // defaults shown to the user
      await expect(f.priority).toHaveValue('medium');
      return f;
    });

    await verifyAC('TP-101:AC4', 'Submit the form; the new task appears in the list', 'dialog closes and row is visible', async () => {
      await form.fill(input);
      await stepScreenshot(page, 'create form filled');
      await form.save();
      await tasksPage.searchFor(input.title);
      await tasksPage.expectTaskVisible(input.title);
      await tasks.adoptByTitle(input.title); // cleanup registration
      return 'row visible';
    });

    await verifyAC('TP-101:AC3', 'Row shows the entered status, priority and due date', 'In progress · High · formatted due date', async () => {
      const row = tasksPage.row(input.title);
      await tasksPage.expectRowStatus(input.title, 'in_progress');
      await expect(row.getByRole('cell').nth(2)).toHaveText(PRIORITY_LABEL.high);
      await expect(row.getByRole('cell').nth(3)).toHaveText(displayDate(input.due_date!));
      await expect(row).toContainText(input.description!);
      await stepScreenshot(page, 'task row');
      return `${STATUS_LABEL.in_progress} · ${PRIORITY_LABEL.high} · ${displayDate(input.due_date!)}`;
    });
  });

  test('whitespace-only title shows a validation error', trace({ testCase: 'TC-UI-011', covers: ['TP-101:AC2'], tags: ['@negative'] }), async ({ page, tasksPage, api }) => {
    await tasksPage.goto();
    const form = await tasksPage.openCreateForm();
    const marker = `   `;

    await verifyAC('TP-101:AC2', 'Submitting a blank title is rejected', 'dialog stays open with a title validation message', async () => {
      await form.fill({ title: marker, description: 'should not be saved' });
      await form.submit.click();
      await expect(form.alerts.filter({ hasText: /title/i })).toBeVisible();
      await expect(form.dialog).toBeVisible();
      await stepScreenshot(page, 'validation error', true);
      return (await form.alerts.first().textContent()) ?? '';
    });

    await verifyAC('TP-101:AC2', 'No task was created', 'no task with that description exists', async () => {
      const { body } = await api.listTasks({ search: 'should not be saved', limit: 100 });
      expect(body.items.filter((t) => t.title.trim() === '')).toHaveLength(0);
      return '0 blank tasks';
    });
  });

  test('cancel discards the new task', trace({ testCase: 'TC-UI-012', covers: ['TP-101:AC4'] }), async ({ tasksPage, api }) => {
    const input = buildTask();
    await tasksPage.goto();
    const form = await tasksPage.openCreateForm();
    await form.fill(input);
    await form.cancel.click();
    await verifyAC('TP-101:AC4', 'Cancelled task is not created', 'dialog closed, no row, API has no task', async () => {
      await expect(form.dialog).toBeHidden();
      await tasksPage.searchFor(input.title);
      await expect(tasksPage.emptyState).toBeVisible();
      expect(await api.findByTitle(input.title)).toHaveLength(0);
      return 'not created';
    });
  });
});
