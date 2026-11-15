/**
 * OPT-IN DEMO — creates tasks through the UI and KEEPS them so students can see them in TaskPilot.
 * Excluded from normal runs; enabled only with DEMO=true (npm run demo:create-tasks).
 * Titles start with "TPW-DEMO-" (not the per-run prefix), so global teardown does not remove them.
 * Remove them later with: npm run demo:cleanup
 */
import { test, expect } from '../../fixtures/test.ts';
import { stepScreenshot } from '../../utils/evidence.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { isoDate, type TaskInput } from '../../utils/test-data.ts';

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const demoTasks: TaskInput[] = [
  { title: `TPW-DEMO-${stamp} Prepare Playwright workshop slides`, description: 'Created by TestPilot PW headed demo (UI).', priority: 'high', status: 'in_progress', due_date: isoDate(3) },
  { title: `TPW-DEMO-${stamp} Record Codegen walkthrough`, description: 'Created by TestPilot PW headed demo (UI).', priority: 'medium', status: 'pending', due_date: isoDate(7) },
  { title: `TPW-DEMO-${stamp} Review AC coverage report`, description: 'Created by TestPilot PW headed demo (UI).', priority: 'low', status: 'completed', due_date: isoDate(1) },
];

test.describe.configure({ mode: 'serial' });

for (const input of demoTasks) {
  test(`demo: create "${input.title.replace(/^TPW-DEMO-\S+ \S+ /, '')}" via UI`, trace({ testCase: 'TC-DEMO-001', covers: ['TP-101:AC4'], tags: ['@demo'] }), async ({ page, tasksPage, api }) => {
    await tasksPage.goto();
    const form = await tasksPage.openCreateForm();
    await form.fill(input);
    await stepScreenshot(page, 'demo form filled', true);
    await form.save();

    await verifyAC('TP-101:AC4', 'Demo task appears in the list and exists in the API', 'row visible + 1 API match', async () => {
      await tasksPage.searchFor(input.title);
      await tasksPage.expectTaskVisible(input.title);
      await tasksPage.expectRowStatus(input.title, input.status!);
      await stepScreenshot(page, 'demo task listed', true);
      const found = await api.findByTitle(input.title);
      expect(found).toHaveLength(1);
      return `id=${found[0].id}`;
    });
  });
}
