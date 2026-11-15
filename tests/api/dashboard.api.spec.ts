import { test, expect } from '../../fixtures/test.ts';
import { expectSchema } from '../../utils/schema-validator.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';

test.describe('API · Dashboard summary (TP-105)', () => {
  test('summary is internally consistent', trace({ testCase: 'TC-API-050', covers: ['TP-105:AC1'], tags: ['@smoke'] }), async ({ api }) => {
    await verifyAC('TP-105:AC1', 'Summary matches schema and status counts add up', 'pending+in_progress+completed = total = Σ by_priority', async () => {
      const { status, body } = await api.dashboardSummary();
      expect(status).toBe(200);
      expectSchema('dashboard-summary', body);
      expect(body.pending + body.in_progress + body.completed).toBe(body.total);
      expect(body.by_priority.low + body.by_priority.medium + body.by_priority.high).toBe(body.total);
      expect(body.overdue).toBeLessThanOrEqual(body.total);
      return `total=${body.total}, pending=${body.pending}, in_progress=${body.in_progress}, completed=${body.completed}`;
    });
  });

  test('recently updated task appears in recent activity', trace({ testCase: 'TC-API-051', covers: ['TP-105:AC2'] }), async ({ api, tasks }) => {
    const task = await tasks.create();
    await verifyAC('TP-105:AC2', 'Updated task is listed in recent_activity', 'recent_activity contains the task, newest first', async () => {
      await api.updateTask(task.id, { status: 'in_progress' });
      const { body } = await api.dashboardSummary();
      // Shared database: other users may update concurrently, so assert presence + ordering, not position 0.
      expect(body.recent_activity.map((t) => t.id)).toContain(task.id);
      const stamps = body.recent_activity.map((t) => Date.parse(t.updated_at));
      expect(stamps).toEqual([...stamps].sort((a, b) => b - a));
      return `position ${body.recent_activity.findIndex((t) => t.id === task.id) + 1} of ${body.recent_activity.length}`;
    });
  });
});
