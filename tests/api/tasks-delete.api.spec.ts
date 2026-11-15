import { test, expect } from '../../fixtures/test.ts';
import type { ApiError } from '../../clients/task-api-client.ts';
import { expectSchema } from '../../utils/schema-validator.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { nonExistentId } from '../../utils/test-data.ts';

test.describe('API · Delete task (TP-104)', () => {
  test('deleted task can no longer be retrieved', trace({ testCase: 'TC-API-040', covers: ['TP-104:AC2'], tags: ['@smoke', '@positive'] }), async ({ api, tasks }) => {
    const task = await tasks.create();
    await verifyAC('TP-104:AC2', 'DELETE returns 204 with empty body', 'HTTP 204', async () => {
      const { status, body } = await api.deleteTask(task.id);
      expect(status).toBe(204);
      expect(body).toBeNull();
      tasks.forget(task.id);
      return `HTTP ${status}`;
    });
    await verifyAC('TP-104:AC2', 'GET after delete returns 404', 'HTTP 404, code=not_found', async () => {
      const { status, body } = await api.getTask(task.id);
      expect(status).toBe(404);
      expectSchema('error', body);
      return `HTTP ${status}`;
    });
    await verifyAC('TP-104:AC2', 'Task no longer appears in search', '0 results', async () => {
      expect(await api.findByTitle(task.title)).toHaveLength(0);
      return '0 results';
    });
  });

  test('deleting a non-existent task returns 404', trace({ testCase: 'TC-API-041', covers: ['TP-104:AC3'], tags: ['@negative'] }), async ({ api }) => {
    await verifyAC('TP-104:AC3', 'DELETE unknown id', 'HTTP 404, code=not_found', async () => {
      const { status, body } = await api.deleteTask(nonExistentId());
      expect(status).toBe(404);
      expect((body as unknown as ApiError).error.code).toBe('not_found');
      return `HTTP ${status}`;
    });
  });

  test('deleting the same task twice', trace({ testCase: 'TC-API-042', covers: ['TP-104:AC3'], tags: ['@negative'] }), async ({ api, tasks }) => {
    const task = await tasks.create();
    await verifyAC('TP-104:AC3', 'Second DELETE returns 404', 'first 204, second 404', async () => {
      expect((await api.deleteTask(task.id)).status).toBe(204);
      tasks.forget(task.id);
      expect((await api.deleteTask(task.id)).status).toBe(404);
      return '204 then 404';
    });
  });
});
