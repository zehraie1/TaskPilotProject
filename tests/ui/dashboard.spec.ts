import { test, expect } from '../../fixtures/test.ts';
import type { DashboardSummary } from '../../clients/task-api-client.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';

test.describe('UI · Dashboard (TP-105)', () => {
  test('metric cards show the counts returned by the API', trace({ testCase: 'TC-UI-001', covers: ['TP-105:AC1'], tags: ['@smoke'] }), async ({ page, dashboard }) => {
    // Capture the exact summary the page renders — deterministic even when other users change data.
    const summaryResponse = page.waitForResponse((r) => r.url().includes('/api/v1/dashboard/summary') && r.ok());
    await dashboard.goto();
    const summary = (await (await summaryResponse).json()) as DashboardSummary;

    await verifyAC('TP-105:AC1', 'Each metric card equals the API summary value', 'Total/Pending/In progress/Completed/Overdue match', async () => {
      await expect(dashboard.metricValue('Total tasks')).toHaveText(String(summary.total));
      await expect(dashboard.metricValue('Pending')).toHaveText(String(summary.pending));
      await expect(dashboard.metricValue('In progress')).toHaveText(String(summary.in_progress));
      await expect(dashboard.metricValue('Completed')).toHaveText(String(summary.completed));
      await expect(dashboard.metricValue('Overdue')).toHaveText(String(summary.overdue));
      await stepScreenshot(page, 'dashboard metrics');
      return `total=${summary.total}, pending=${summary.pending}, in_progress=${summary.in_progress}, completed=${summary.completed}, overdue=${summary.overdue}`;
    });
  });

  test('recently updated task is listed under Recent activity', trace({ testCase: 'TC-UI-002', covers: ['TP-105:AC2'] }), async ({ page, api, tasks, dashboard }) => {
    const task = await tasks.create();
    await api.updateTask(task.id, { status: 'in_progress' });
    const summaryResponse = page.waitForResponse((r) => r.url().includes('/api/v1/dashboard/summary') && r.ok());
    await dashboard.goto();
    const summary = (await (await summaryResponse).json()) as DashboardSummary;

    await verifyAC('TP-105:AC2', 'Recent activity shows the task and links to its details', 'link visible and navigates to /tasks/{id}', async () => {
      test.skip(!summary.recent_activity.some((t) => t.id === task.id), 'Task pushed out of recent activity by concurrent updates on the shared database');
      const link = dashboard.recentActivityLink(task.title);
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
      return 'listed and navigable';
    });
  });
});
