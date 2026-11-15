import { test, expect } from '../../fixtures/test.ts';
import type { ApiError } from '../../clients/task-api-client.ts';
import { expectSchema } from '../../utils/schema-validator.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { LIMITS, nonExistentId, uniqueTitle } from '../../utils/test-data.ts';

test.describe('API · Read & list tasks (TP-102)', () => {
  test('get task by id returns full details', trace({ testCase: 'TC-API-020', covers: ['TP-102:AC5'], tags: ['@smoke', '@positive'] }), async ({ api, tasks }) => {
    const task = await tasks.create({ priority: 'low' });
    await verifyAC('TP-102:AC5', 'GET /tasks/{id} returns every field', 'HTTP 200, task schema, values equal created task', async () => {
      const { status, body } = await api.getTask(task.id);
      expect(status).toBe(200);
      expectSchema('task', body);
      expect(body).toEqual(task);
      return `HTTP ${status}`;
    });
  });

  test('unknown and malformed ids', trace({ testCase: 'TC-API-021', covers: ['TP-102:AC5'], tags: ['@negative'] }), async ({ api }) => {
    await verifyAC('TP-102:AC5', 'Unknown UUID returns not found', 'HTTP 404, code=not_found', async () => {
      const { status, body } = await api.getTask(nonExistentId());
      expect(status).toBe(404);
      expectSchema('error', body);
      expect((body as unknown as ApiError).error.code).toBe('not_found');
      return `HTTP ${status}`;
    });
    await verifyAC('TP-102:AC5', 'Malformed id is rejected', 'HTTP 422, code=validation_error', async () => {
      const { status, body } = await api.getTask('not-a-uuid');
      expect(status).toBe(422);
      expect((body as unknown as ApiError).error.code).toBe('validation_error');
      return `HTTP ${status}`;
    });
  });

  test('search returns only matching tasks', trace({ testCase: 'TC-API-022', covers: ['TP-102:AC1'], tags: ['@positive'] }), async ({ api, tasks }) => {
    const marker = uniqueTitle('search').split(' ')[0]; // unique token, e.g. TPW-<run>-w0-ab12cd
    const a = await tasks.create({ title: `${marker} alpha` });
    const b = await tasks.create({ title: `${marker} beta`, description: 'other' });
    await tasks.create({ title: uniqueTitle('unrelated') });

    await verifyAC('TP-102:AC1', 'Search by unique token returns exactly the matching tasks', '2 results: alpha and beta', async () => {
      const { status, body } = await api.listTasks({ search: marker, limit: 100 });
      expect(status).toBe(200);
      expectSchema('task-list', body);
      expect(body.items.map((t) => t.id).sort()).toEqual([a.id, b.id].sort());
      expect(body.total).toBe(2);
      return `HTTP ${status}, total=${body.total}`;
    });
    await verifyAC('TP-102:AC1', 'Search also matches the description', 'searching description text returns the task', async () => {
      const token = `desc-${marker}`;
      const c = await tasks.create({ title: uniqueTitle('by-desc'), description: `contains ${token}` });
      const { body } = await api.listTasks({ search: token });
      expect(body.items.map((t) => t.id)).toEqual([c.id]);
      return `total=${body.total}`;
    });
  });

  test('status filter returns only that status', trace({ testCase: 'TC-API-023', covers: ['TP-102:AC2'], tags: ['@positive'] }), async ({ api, tasks }) => {
    const marker = uniqueTitle('filter').split(' ')[0];
    const pending = await tasks.create({ title: `${marker} p`, status: 'pending' });
    const done = await tasks.create({ title: `${marker} c`, status: 'completed' });

    for (const [status, expectedId] of [['pending', pending.id], ['completed', done.id]] as const) {
      await verifyAC('TP-102:AC2', `Filter status=${status}`, `only the ${status} task is returned`, async () => {
        const res = await api.listTasks({ search: marker, status });
        expect(res.status).toBe(200);
        expect(res.body.items.map((t) => t.id)).toEqual([expectedId]);
        expect(res.body.items.every((t) => t.status === status)).toBe(true);
        return `total=${res.body.total}`;
      });
    }
  });

  const limits = [
    { limit: LIMITS.pageLimitMin, expected: 200 },
    { limit: LIMITS.pageLimitMax, expected: 200 },
    { limit: LIMITS.pageLimitMin - 1, expected: 422 },
    { limit: LIMITS.pageLimitMax + 1, expected: 422 },
  ];
  for (const { limit, expected } of limits) {
    test(`page size ${limit} → HTTP ${expected}`, trace({ testCase: 'TC-API-024', covers: ['TP-102:AC4'], tags: ['@boundary'] }), async ({ api }) => {
      await verifyAC('TP-102:AC4', `limit=${limit}`, `HTTP ${expected}`, async () => {
        const { status, body } = await api.listTasks({ limit });
        expect(status).toBe(expected);
        if (expected === 200) {
          expectSchema('task-list', body);
          expect(body.limit).toBe(limit);
          expect(body.items.length).toBeLessThanOrEqual(limit);
        } else {
          expectSchema('error', body);
        }
        return `HTTP ${status}`;
      });
    });
  }

  test('pagination offset walks through results without overlap', trace({ testCase: 'TC-API-025', covers: ['TP-102:AC4'] }), async ({ api, tasks }) => {
    const marker = uniqueTitle('page').split(' ')[0];
    for (const n of [1, 2, 3]) await tasks.create({ title: `${marker} ${n}` });
    await verifyAC('TP-102:AC4', 'Two pages of size 2 contain all 3 tasks once', 'page1=2 items, page2=1 item, no overlap', async () => {
      const p1 = await api.listTasks({ search: marker, limit: 2, offset: 0, sort_by: 'title', sort_order: 'asc' });
      const p2 = await api.listTasks({ search: marker, limit: 2, offset: 2, sort_by: 'title', sort_order: 'asc' });
      expect(p1.body.total).toBe(3);
      expect(p1.body.items).toHaveLength(2);
      expect(p2.body.items).toHaveLength(1);
      const titles = [...p1.body.items, ...p2.body.items].map((t) => t.title);
      expect(titles).toEqual([`${marker} 1`, `${marker} 2`, `${marker} 3`]);
      return `page1=${p1.body.items.length}, page2=${p2.body.items.length}`;
    });
  });
});
