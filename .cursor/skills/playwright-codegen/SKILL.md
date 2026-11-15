---
name: playwright-codegen
description: Record browser interactions with Playwright Codegen and refactor them into production-quality, traceable POM tests.
---
# Playwright Codegen

## Purpose
Use Codegen to discover locators and flows quickly — then refactor, because raw recordings are not production automation.

## When to use
- Exploring a new screen or flow.
- Finding robust locators for page objects.
- Live workshop demos of "record → review → refactor".

## Required inputs
- Running TaskPilot UI (`UI_BASE_URL` or `http://localhost:5173`).
- Approved test case for the flow being recorded.

## Step-by-step workflow
1. `npm run codegen` (or `npm run codegen -- http://localhost:5173`). Output → `generated/codegen/recording-*.spec.ts`.
2. Perform the flow; use the **Pick locator** tool to inspect locators; add assertions with the toolbar (visibility/text/value).
3. Close the browser; open the recording.
4. Review against the checklist in `docs/codegen/recorded-create-task.raw.ts` (❌ markers).
5. Refactor:
   - move locators into `pages/*` (reuse existing ones first),
   - replace absolute URLs with `page.goto('/…')`,
   - replace literals with `buildTask()` / `uniqueTitle()`,
   - delete redundant `click()` before `fill()`,
   - add `trace()` + `verifyAC()` with business assertions,
   - register created data for cleanup (`tasks.adoptByTitle`).
6. Save as `tests/<layer>/<feature>.spec.ts`; run it 3× (`--repeat-each=3`) to prove stability.
7. Compare with `tests/codegen/create-task.refactored.spec.ts`.

## Rules and constraints
- Never commit raw recordings into `tests/`.
- Prefer role/label/test-id locators Codegen suggests; reject nth()/CSS chains unless justified.
- Codegen assertions are a start, not proof of business outcome.

## Expected outputs
- A refactored, passing spec using page objects, unique data, AC steps and cleanup.

## Verification checklist
- [ ] No hard-coded URL, data or sleeps.
- [ ] All locators come from page objects.
- [ ] At least one `verifyAC` per AC covered.
- [ ] Passes with `--repeat-each=3` and leaves no `TPW-*` data.
