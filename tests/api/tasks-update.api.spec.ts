import { test, expect } from '../../fixtures/test.ts';
import type { ApiError, Task } from '../../clients/task-api-client.ts';
import { expectSchema } from '../../utils/schema-validator.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { isoDate, nonExistentId, uniqueTitle, type TaskStatus } from '../../utils/test-data.ts';

test.describe('API · Update task (TP-103)', () => {
  test('edit title, description, priority and due date', trace({ testCase: 'TC-API-030', covers: ['TP-103:AC1', 'TP-103:AC4'], tags: ['@smoke', '@positive'] }), async ({ api, tasks }) => {
    const original = await tasks.create({ priority: 'low' });
    const changes = { title: uniqueTitle('edited'), description: 'Updated by API test', priority: 'high' as const, due_date: isoDate(7) };
    let updated!: Task;

    await verifyAC('TP-103:AC1', 'PATCH applies the changes', 'HTTP 200 and response reflects every change', async () => {
      const { status, body } = await api.updateTask(original.id, changes);
      expect(status).toBe(200);
      expectSchema('task', body);
      expect(body).toMatchObject({ ...changes, id: original.id, status: original.status });
      updated = body;
      return `HTTP ${status}`;
    });
    await verifyAC('TP-103:AC1', 'Changes are persisted', 'GET returns the updated values', async () => {
      const { body } = await api.getTask(original.id);
      expect(body).toEqual(updated);
      return 'persisted';
    });
    await verifyAC('TP-103:AC4', 'updated_at is refreshed, created_at unchanged', 'updated_at > previous updated_at', async () => {
      expect(Date.parse(updated.updated_at)).toBeGreaterThan(Date.parse(original.updated_at));
      expect(updated.created_at).toBe(original.created_at);
      return `${original.updated_at} → ${updated.updated_at}`;
    });
  });

  test('status moves through the full workflow', trace({ testCase: 'TC-API-031', covers: ['TP-103:AC2'], tags: ['@positive'] }), async ({ api, tasks }) => {
    const task = await tasks.create({ status: 'pending' });
    const workflow: TaskStatus[] = ['in_progress', 'completed', 'pending'];
    for (const next of workflow) {
      await verifyAC('TP-103:AC2', `Change status to ${next}`, `HTTP 200, status=${next}, persisted`, async () => {
        const res = await api.updateTask(task.id, { status: next });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(next);
        expect((await api.getTask(task.id)).body.status).toBe(next);
        return `status=${res.body.status}`;
      });
    }
  });

  const invalidUpdates: { name: string; patch: Record<string, unknown> }[] = [
    { name: 'empty title', patch: { title: '' } },
    { name: 'title over 120 chars', patch: { title: 'x'.repeat(121) } },
    { name: 'unknown status', patch: { status: 'archived' } },
    { name: 'unknown priority', patch: { priority: 'critical' } },
  ];
  for (const { name, patch } of invalidUpdates) {
    test(`rejects update with ${name}`, trace({ testCase: 'TC-API-032', covers: ['TP-103:AC3'], tags: ['@negative'] }), async ({ api, tasks }) => {
      const task = await tasks.create();
      await verifyAC('TP-103:AC3', `PATCH with ${name} is rejected`, 'HTTP 422', async () => {
        const { status, body } = await api.updateTask(task.id, patch);
        expect(status).toBe(422);
        expectSchema('error', body);
        return `HTTP ${status}`;
      });
      await verifyAC('TP-103:AC3', 'Task remains unchanged', 'GET returns the original task', async () => {
        expect((await api.getTask(task.id)).body).toEqual(task);
        return 'unchanged';
      });
    });
  }

  test('update of a non-existent task returns 404', trace({ testCase: 'TC-API-033', covers: ['TP-103:AC3'], tags: ['@negative'] }), async ({ api }) => {
    await verifyAC('TP-103:AC3', 'PATCH unknown id', 'HTTP 404, code=not_found', async () => {
      const { status, body } = await api.updateTask(nonExistentId(), { status: 'completed' });
      expect(status).toBe(404);
      expect((body as unknown as ApiError).error.code).toBe('not_found');
      return `HTTP ${status}`;
    });
  });
});
