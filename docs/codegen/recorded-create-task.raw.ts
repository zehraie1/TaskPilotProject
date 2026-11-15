// ⚠️ RAW CODEGEN OUTPUT — kept for teaching. NOT part of the test suite (not a *.spec.ts file).
// Recorded with: npm run codegen   (npx playwright codegen https://taskpilot-web.onrender.com)
// Problems to fix during review are marked with  // ❌
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {                                        // ❌ meaningless test name, no traceability
  await page.goto('https://taskpilot-web.onrender.com/');                  // ❌ hard-coded environment URL
  await page.getByRole('link', { name: 'Tasks' }).click();
  await page.getByTestId('create-task').click();
  await page.getByRole('textbox', { name: 'Title*' }).click();             // ❌ redundant click before fill
  await page.getByRole('textbox', { name: 'Title*' }).fill('My demo task'); // ❌ static data → collides on a shared DB
  await page.getByRole('textbox', { name: 'Description' }).click();
  await page.getByRole('textbox', { name: 'Description' }).fill('recorded');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByTestId('save-task').click();
  await page.getByRole('searchbox', { name: 'Search tasks' }).click();
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('My demo task');
  await page.getByRole('link', { name: 'View My demo task' }).click();     // ❌ no assertion that anything worked
});                                                                         // ❌ no cleanup — task left in the database
