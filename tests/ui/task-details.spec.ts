import { test, expect } from '../../fixtures/test.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { PRIORITY_LABEL, displayDate, isoDate, nonExistentId } from '../../utils/test-data.ts';

test.describe('UI · Task details (TP-102)', () => {
  test('details page shows every task field', trace({ testCase: 'TC-UI-050', covers: ['TP-102:AC5'] }), async ({ page, tasksPage, details, tasks }) => {
    const task = await tasks.create({ description: 'Details page check', priority: 'high', due_date: isoDate(5) });
    await tasksPage.goto();
    await tasksPage.searchFor(task.title);
    await tasksPage.openDetails(task.title);

    await verifyAC('TP-102:AC5', 'Title, description, status, priority, due date, id and timestamps are displayed', 'all fields visible with correct values', async () => {
      await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
      await details.expectLoaded(task.title);
      await expect(details.card).toContainText(task.description!);
      await expect(details.statusSelect).toHaveValue(task.status);
      await expect(details.card).toContainText(PRIORITY_LABEL.high);
      await expect(details.card).toContainText(displayDate(task.due_date!));
      await expect(details.field('Task ID')).toHaveText(task.id);
      await expect(details.field('Created')).not.toBeEmpty();
      await expect(details.field('Updated')).not.toBeEmpty();
      await stepScreenshot(page, 'task details');
      return `id=${task.id}`;
    });
    await test.step('Back link returns to the task list', async () => {
      await details.backLink.click();
      await expect(tasksPage.heading).toHaveText('Tasks');
    });
  });

  test('unknown task id shows a not-found error', trace({ testCase: 'TC-UI-051', covers: ['TP-102:AC5', 'TP-106:AC2'], tags: ['@negative'] }), async ({ page, details }) => {
    await details.goto(nonExistentId());
    await verifyAC('TP-106:AC2', 'Error state with message and retry', '"We couldn’t load this page", "Task not found", "Try again"', async () => {
      await expect(details.errorState).toBeVisible();
      await expect(page.getByRole('main')).toContainText('Task not found');
      await expect(details.retryButton).toBeVisible();
      return 'Task not found';
    });
    await verifyAC('TP-102:AC5', 'No task details are rendered', 'no task heading or status control', async () => {
      await expect(details.statusSelect).toHaveCount(0);
      return 'no details rendered';
    });
  });
});
