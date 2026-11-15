/**
 * Project-wide Playwright fixtures. Import { test, expect } from here — never from '@playwright/test' in specs.
 *
 *   api        → TaskApiClient bound to API_BASE_URL (works in both UI and API projects)
 *   tasks      → TaskFactory with deterministic cleanup
 *   dashboard / tasksPage / details → page objects
 */
import { test as base, expect, request as playwrightRequest } from '@playwright/test';
import { env } from '../config/env.ts';
import { TaskApiClient } from '../clients/task-api-client.ts';
import { DashboardPage, TaskDetails, TasksPage } from '../pages/index.ts';
import { ApiEvidenceLog } from '../utils/evidence.ts';
import { TaskFactory } from './task-factory.ts';

interface Fixtures {
  apiLog: ApiEvidenceLog;
  api: TaskApiClient;
  tasks: TaskFactory;
  dashboard: DashboardPage;
  tasksPage: TasksPage;
  details: TaskDetails;
}

export const test = base.extend<Fixtures>({
  apiLog: async ({}, use, testInfo) => {
    const log = new ApiEvidenceLog();
    await use(log);
    // Sanitized API evidence: always in full mode, otherwise only when the test failed.
    if (env.evidence === 'full' || testInfo.status !== testInfo.expectedStatus) await log.attachTo();
  },

  api: async ({ apiLog }, use) => {
    const ctx = await playwrightRequest.newContext({
      baseURL: env.apiBaseUrl,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    await use(new TaskApiClient(ctx, apiLog));
    await ctx.dispose();
  },

  tasks: async ({ api }, use) => {
    const factory = new TaskFactory(api);
    await use(factory);
    await factory.cleanup();
  },

  dashboard: async ({ page }, use) => use(new DashboardPage(page)),
  tasksPage: async ({ page }, use) => use(new TasksPage(page)),
  details: async ({ page }, use) => use(new TaskDetails(page)),
});

export { expect };
