---
name: page-object-model
description: Design and extend page objects (DashboardPage, TasksPage, TaskForm, TaskDetails) with semantic, stable locators and reusable actions.
---
# Page Object Model

## Purpose
Keep UI knowledge (locators, interactions) in one place so specs read as business flows and survive UI changes.

## When to use
- New screen/component, new interaction, or a locator change.
- Refactoring Codegen output.

## Required inputs
- Accessibility snapshot or Codegen locators of the real UI.
- Existing `pages/` classes.

## Step-by-step workflow
1. Inspect the UI: `await page.locator('main').ariaSnapshot()` or Codegen "Pick locator".
2. Choose locators: role+name → label → `data-testid` (existing: create-task, header-create-task, task-form, save-task, task-status, search-tasks, status-filter, sort-tasks, delete-task-detail) → text.
3. Add `readonly` Locator fields in the constructor; scope inside containers (dialog, row, article).
4. Add intention-revealing actions returning `Promise<void>` or another page object (`openCreateForm(): TaskForm`).
5. Row-scoped locators use the unique accessible name (`Edit <title>`), never row index.
6. Handle native dialogs with `page.once('dialog')` before clicking.
7. Export from `pages/index.ts`; add/extend fixtures in `fixtures/test.ts`.

## Rules and constraints
- No assertions about business rules, no API calls, no test data, no sleeps in page objects.
- State-confirming waits are fine (e.g. `expect(dialog).toBeHidden()` after save).
- Never index rows by position on the shared database.

## Expected outputs
- Updated `pages/*.ts` with typed, reusable members.

## Verification checklist
- [ ] Locators resolve to exactly one element in the target scope.
- [ ] No duplication with existing page objects.
- [ ] `npm run typecheck` passes; affected UI specs pass.
