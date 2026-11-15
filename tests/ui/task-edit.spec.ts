import { test, expect } from '../../fixtures/test.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { PRIORITY_LABEL, displayDate, isoDate, uniqueTitle } from '../../utils/test-data.ts';

test.describe('UI · Edit task and change status (TP-103)', () => {
  test('edit a task from the list', trace({ testCase: 'TC-UI-030', covers: ['TP-103:AC1'], tags: ['@smoke'] }), async ({ page, tasksPage, tasks, api }) => {
    const task = await tasks.create({ priority: 'low' });
    const changes = { title: uniqueTitle('edited-ui'), description: 'Edited through the UI', priority: 'high' as const, due_date: isoDate(21) };
    await tasksPage.goto();
    await tasksPage.searchFor(task.title);

    const form = await test.step('Open edit dialog prefilled with current values', async () => {
      const f = await tasksPage.openEditForm(task.title);
      await expect(f.title).toHaveValue(task.title);
      await expect(f.priority).toHaveValue('low');
      return f;
    });

    await verifyAC('TP-103:AC1', 'Save changes; list shows the new values', 'row shows new title, priority and due date', async () => {
      await form.fill(changes);
      await form.save();
      await tasksPage.searchFor(changes.title);
      const row = tasksPage.row(changes.title);
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('cell').nth(2)).toHaveText(PRIORITY_LABEL.high);
      await expect(row.getByRole('cell').nth(3)).toHaveText(displayDate(changes.due_date));
      await stepScreenshot(page, 'edited row');
      return `title=${changes.title}`;
    });

    await verifyAC('TP-103:AC1', 'Changes are persisted in the API', 'GET returns the edited values', async () => {
      const { body } = await api.getTask(task.id);
      expect(body).toMatchObject(changes);
      return 'persisted';
    });
  });

  test('change status from the task details page', trace({ testCase: 'TC-UI-031', covers: ['TP-103:AC2'] }), async ({ details, tasks, api }) => {
    const task = await tasks.create({ status: 'pending' });
    await details.goto(task.id);
    await details.expectLoaded(task.title);

    await verifyAC('TP-103:AC2', 'Select "In progress" on the details page', 'badge + select show In progress; API status in_progress', async () => {
      await details.changeStatus('in_progress');
      await expect(details.statusSelect).toHaveValue('in_progress');
      await expect(details.card).toContainText('In progress');
      await expect.poll(async () => (await api.getTask(task.id)).body.status).toBe('in_progress');
      return 'in_progress';
    });
  });
});
