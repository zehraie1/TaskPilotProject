---
name: hybrid-testing
description: Build UI+API hybrid scenarios that arrange via one channel, act via another, and verify consistency across both.
---
# Hybrid Testing

## Purpose
Prove that the UI and the API agree — the end-to-end truth — while keeping tests fast.

## When to use
- Scenarios A–E (create/update/complete/delete across channels).
- Any AC whose outcome must be visible in the UI **and** persisted in the backend.

## Required inputs
- Page objects, TaskApiClient, TaskFactory fixtures.

## Step-by-step workflow
1. Pick the pattern:
   - A: API create → UI verify · B: UI create → API verify · C: API update → UI verify
   - D: UI complete → API verify · E: UI delete → UI + API verify (404)
2. Arrange with the API (`tasks.create`).
3. Act in the UI; when the UI triggers a request, capture it with `page.waitForResponse` to confirm the call succeeded.
4. Verify in the *other* channel inside `verifyAC()`; use `expect.poll` for eventual consistency.
5. For UI-created data call `tasks.adoptByTitle(title)`; for UI-deleted data call `tasks.forget(id)`.
6. Reference: `tests/hybrid/task-lifecycle.hybrid.spec.ts`.

## Rules and constraints
- Unique identifiers in every scenario; never search for generic titles.
- Do not verify through the same channel you acted with (that is not hybrid).

## Expected outputs
- Passing hybrid spec with AC steps on both channels.

## Verification checklist
- [ ] Act and verify use different channels.
- [ ] Cleanup deterministic in all branches.
- [ ] No sleeps; polling only via `expect.poll`.
