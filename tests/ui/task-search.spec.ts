import { test, expect } from '../../fixtures/test.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { uniqueTitle } from '../../utils/test-data.ts';

test.describe('UI · Search, filter, empty state (TP-102)', () => {
  test('search narrows the list to matching tasks', trace({ testCase: 'TC-UI-020', covers: ['TP-102:AC1'], tags: ['@smoke'] }), async ({ page, tasksPage, tasks }) => {
    const marker = uniqueTitle('ui-search').split(' ')[0];
    const a = await tasks.create({ title: `${marker} Alpha` });
    const b = await tasks.create({ title: `${marker} Beta` });
    await tasksPage.goto();

    await verifyAC('TP-102:AC1', 'Search by unique token shows exactly the 2 matching tasks', '2 rows: Alpha and Beta', async () => {
      await tasksPage.searchFor(marker);
      await expect(tasksPage.rows).toHaveCount(2);
      await tasksPage.expectTaskVisible(a.title);
      await tasksPage.expectTaskVisible(b.title);
      await stepScreenshot(page, 'search results');
      return '2 rows';
    });
    await verifyAC('TP-102:AC1', 'Refining the search shows only Alpha', '1 row', async () => {
      await tasksPage.searchFor(`${marker} Alpha`);
      await expect(tasksPage.rows).toHaveCount(1);
      await tasksPage.expectTaskVisible(a.title);
      return '1 row';
    });
  });

  test('status filter shows only tasks in that status', trace({ testCase: 'TC-UI-021', covers: ['TP-102:AC2'] }), async ({ tasksPage, tasks }) => {
    const marker = uniqueTitle('ui-filter').split(' ')[0];
    const pending = await tasks.create({ title: `${marker} pending`, status: 'pending' });
    const done = await tasks.create({ title: `${marker} done`, status: 'completed' });
    await tasksPage.goto();
    await tasksPage.searchFor(marker);
    await expect(tasksPage.rows).toHaveCount(2);

    await verifyAC('TP-102:AC2', 'Filter = Completed', 'only the completed task is listed', async () => {
      await tasksPage.filterByStatus('completed');
      await expect(tasksPage.rows).toHaveCount(1);
      await tasksPage.expectTaskVisible(done.title);
      await tasksPage.expectRowStatus(done.title, 'completed');
      return '1 row (completed)';
    });
    await verifyAC('TP-102:AC2', 'Filter = Pending', 'only the pending task is listed', async () => {
      await tasksPage.filterByStatus('pending');
      await expect(tasksPage.rows).toHaveCount(1);
      await tasksPage.expectTaskVisible(pending.title);
      return '1 row (pending)';
    });
  });

  test('no match shows the empty state', trace({ testCase: 'TC-UI-022', covers: ['TP-102:AC3'], tags: ['@negative'] }), async ({ page, tasksPage }) => {
    await tasksPage.goto();
    await verifyAC('TP-102:AC3', 'Search for a value that cannot exist', '"No matching tasks" and no rows', async () => {
      await tasksPage.searchFor(`${uniqueTitle('none')}-no-such-task`);
      await expect(tasksPage.emptyState).toBeVisible();
      await expect(page.getByText('Try changing your search or status filter.')).toBeVisible();
      await expect(tasksPage.table).toBeHidden();
      await stepScreenshot(page, 'empty state');
      return 'empty state shown';
    });
  });

  test('list is paginated', trace({ testCase: 'TC-UI-023', covers: ['TP-102:AC4'] }), async ({ tasksPage }) => {
    await tasksPage.goto();
    await verifyAC('TP-102:AC4', 'Pagination summary and controls are shown', '"Showing x–y of n tasks" and page controls', async () => {
      await expect(tasksPage.paginationSummary).toBeVisible();
      const summary = (await tasksPage.paginationSummary.textContent()) ?? '';
      const [, from, to, total] = summary.match(/Showing (\d+)–(\d+) of (\d+)/) ?? [];
      expect(Number(from)).toBe(1);
      expect(Number(to) - Number(from) + 1).toBe(await tasksPage.rows.count());
      if (Number(total) > Number(to)) {
        await tasksPage.page.getByRole('button', { name: 'Next page' }).click();
        await expect(tasksPage.paginationSummary).toContainText(`Showing ${Number(to) + 1}–`);
      }
      return summary;
    });
  });
});
