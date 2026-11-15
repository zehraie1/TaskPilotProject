---
name: ui-automation
description: Write reliable Playwright UI tests for TaskPilot using fixtures, page objects, AC steps, and deterministic loading/error handling.
---
# UI Automation

## Purpose
Validate what users see and do in TaskPilot, reliably and in parallel on a shared environment.

## When to use
- Approved test case with Automation Type = UI.
- Verifying loading, empty and error states.

## Required inputs
- Approved test case (ID, AC, steps, expected results).
- Page objects for the involved screens.

## Step-by-step workflow
1. Create `tests/ui/<feature>.spec.ts`; import `{ test, expect }` from `fixtures/test.ts`.
2. Declare `trace({ testCase, covers, tags })`.
3. Arrange data through the API (`tasks.create`) — faster and more stable than UI setup.
4. Navigate with page-object `goto()`; narrow lists with `searchFor(uniqueTitle)`.
5. Act through page-object actions.
6. Assert inside `verifyAC()` using web-first assertions (`toBeVisible`, `toHaveText`, `toHaveValue`, `toHaveCount`).
7. For deterministic states use `page.route()`: hold a response (loading) or `abort()` (error) — see `tests/ui/loading-and-errors.spec.ts`.
8. To compare UI with backend data, capture the page's own response with `page.waitForResponse` (see dashboard spec).
9. Add `stepScreenshot(page, name)` at meaningful checkpoints.
10. Run: `npx playwright test tests/ui/<file> --project=chromium`, then `--repeat-each=3`.

## Rules and constraints
- Chromium default; Firefox/WebKit opt-in via `npm run test:all-browsers`.
- No `waitForTimeout`, no position-based row access, no seed data.
- `test.skip()` with a reason is allowed only for documented environmental conditions.

## Expected outputs
- Passing UI spec with AC steps, screenshots in full mode, and cleanup.

## Verification checklist
- [ ] Business outcome asserted, not just clicks performed.
- [ ] Independent and parallel-safe.
- [ ] Stable over 3 repetitions.
- [ ] Added to `data/test-cases/catalogue.json`.
