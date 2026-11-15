---
name: test-data-management
description: Create unique, isolated, self-cleaning test data for a shared TaskPilot database using builders, factories and run prefixes.
---
# Test Data Management

## Purpose
Guarantee independent, repeatable, parallel tests on a database shared by many users.

## When to use
- Any test that reads or writes tasks.
- Debugging collisions, flakiness or leftover data.

## Required inputs
- `utils/test-data.ts` (builders), `fixtures/task-factory.ts` (TaskFactory).

## Step-by-step workflow
1. Run id `TPW_RUN_ID` is generated once per execution (`config/env.ts`) and inherited by workers.
2. Titles: `uniqueTitle(label)` → `TPW-<runId>-w<worker>-<6 hex> <label>`.
3. Builders: `buildTask(overrides)` gives valid defaults; override only what matters.
4. Boundaries: `titleOfLength(n)`, `stringOfLength(n)`, `LIMITS`.
5. Arrange: `await tasks.create({...})` (asserts 201, registers id).
6. UI-created: `await tasks.adoptByTitle(title)`; test-deleted: `tasks.forget(id)`.
7. Cleanup: fixture teardown deletes all registered ids (204/404 accepted); global teardown deletes any `TPW-<runId>*` leftovers.
8. Group related tasks with a shared token: `const marker = uniqueTitle('x').split(' ')[0]`.

## Rules and constraints
- Never depend on seed tasks, totals, or ordering of other users' data.
- Never delete data you did not create (prefix check in teardown).
- No personal data in test data.

## Expected outputs
- Deterministic data per test; zero leftovers after the run.

## Verification checklist
- [ ] `curl "$API_BASE_URL/api/v1/tasks?search=TPW-"` → `total: 0` after a run.
- [ ] Tests pass with `--repeat-each=3 --workers=4`.
