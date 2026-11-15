/**
 * Hybrid UI + API scenarios A–E.
 * Pattern: arrange through the fastest channel, act through the channel under test, assert through the OTHER channel.
 */
import { test, expect } from '../../fixtures/test.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { buildTask, isoDate } from '../../utils/test-data.ts';

test.describe('Hybrid · Task lifecycle across UI and API', () => {
  test('A: task created via API appears in the UI', trace({ testCase: 'TC-HYB-001', covers: ['TP-101:AC4'], tags: ['@smoke', '@hybrid'] }), async ({ page, tasks, tasksPage }) => {
    const task = await test.step('Arrange: create task via API', () => tasks.create({ priority: 'high', status: 'in_progress' }));

    await verifyAC('TP-101:AC4', 'Task created via API is listed in the UI', 'row visible with status In progress', async () => {
      await tasksPage.goto();
      await tasksPage.searchFor(task.title);
      await tasksPage.expectTaskVisible(task.title);
      await tasksPage.expectRowStatus(task.title, 'in_progress');
      await stepScreenshot(page, 'A - api task in ui');
      return 'row visible';
    });
  });

  test('B: task created via UI exists in the API', trace({ testCase: 'TC-HYB-002', covers: ['TP-101:AC1', 'TP-101:AC3'], tags: ['@smoke', '@hybrid'] }), async ({ page, tasks, tasksPage, api }) => {
    const input = buildTask({ priority: 'low', due_date: isoDate(3) });

    await test.step('Act: create task through the UI form', async () => {
      await tasksPage.goto();
      const form = await tasksPage.openCreateForm();
      await form.fillAndSave({ title: input.title, description: input.description, priority: input.priority, due_date: input.due_date });
      await stepScreenshot(page, 'B - created in ui');
    });

    const created = await verifyAC('TP-101:AC1', 'API returns the UI-created task with a unique id and default status', 'exactly 1 task, status=pending', async () => {
      const t = await tasks.adoptByTitle(input.title);
      expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(t.status).toBe('pending');
      return JSON.stringify({ id: t.id, status: t.status });
    });

    await verifyAC('TP-101:AC3', 'Entered values are stored exactly', 'description, priority, due date equal the form input', async () => {
      const { body } = await api.getTask(JSON.parse(created).id);
      expect(body).toMatchObject({ description: input.description, priority: 'low', due_date: input.due_date });
      return `priority=${body.priority}, due_date=${body.due_date}`;
    });
  });

  test('C: status updated via API is shown in the UI', trace({ testCase: 'TC-HYB-003', covers: ['TP-103:AC2'], tags: ['@hybrid'] }), async ({ page, tasks, api, details }) => {
    const task = await tasks.create({ status: 'pending' });

    await test.step('Act: PATCH status=completed via API', async () => {
      const { status } = await api.updateTask(task.id, { status: 'completed' });
      expect(status).toBe(200);
    });

    await verifyAC('TP-103:AC2', 'Details page shows the API-updated status', 'status select = completed', async () => {
      await details.goto(task.id);
      await details.expectLoaded(task.title);
      await expect(details.statusSelect).toHaveValue('completed');
      await stepScreenshot(page, 'C - status in ui');
      return 'completed';
    });
  });

  test('D: task completed in the UI is completed in the API', trace({ testCase: 'TC-HYB-004', covers: ['TP-103:AC2'], tags: ['@smoke', '@hybrid'] }), async ({ page, tasks, api, tasksPage }) => {
    const task = await tasks.create({ status: 'in_progress' });

    await test.step('Act: change status to Completed from the task list', async () => {
      await tasksPage.goto();
      await tasksPage.searchFor(task.title);
      const saved = page.waitForResponse((r) => r.url().endsWith(`/api/v1/tasks/${task.id}`) && r.request().method() === 'PATCH');
      await tasksPage.changeStatus(task.title, 'completed');
      expect((await saved).status()).toBe(200);
      await tasksPage.expectRowStatus(task.title, 'completed');
    });

    await verifyAC('TP-103:AC2', 'API reports status=completed and a newer updated_at', 'status=completed', async () => {
      const { body } = await api.getTask(task.id);
      expect(body.status).toBe('completed');
      expect(Date.parse(body.updated_at)).toBeGreaterThan(Date.parse(task.updated_at));
      return `status=${body.status}`;
    });
  });

  test('E: deleted task is no longer available in UI or API', trace({ testCase: 'TC-HYB-005', covers: ['TP-104:AC1', 'TP-104:AC2'], tags: ['@smoke', '@hybrid'] }), async ({ page, tasks, api, tasksPage }) => {
    const task = await tasks.create();
    await tasksPage.goto();
    await tasksPage.searchFor(task.title);

    await verifyAC('TP-104:AC1', 'Cancelling the confirmation keeps the task', 'confirm text names the task; row and API record remain', async () => {
      const message = await tasksPage.deleteTask(task.title, false);
      expect(message).toContain(task.title);
      await tasksPage.expectTaskVisible(task.title);
      expect((await api.getTask(task.id)).status).toBe(200);
      return message;
    });

    await verifyAC('TP-104:AC2', 'Confirmed delete removes the task from the UI', 'row disappears', async () => {
      await tasksPage.deleteTask(task.title, true);
      await tasksPage.expectTaskAbsent(task.title);
      await stepScreenshot(page, 'E - deleted');
      return 'row removed';
    });

    await verifyAC('TP-104:AC2', 'API no longer returns the task', 'HTTP 404', async () => {
      await expect.poll(async () => (await api.getTask(task.id)).status).toBe(404);
      tasks.forget(task.id);
      return 'HTTP 404';
    });
  });
});
