---
name: automation-quality-review
description: Review automation code for reliability, maintainability, traceability, security and honest reporting before merge.
---
# Automation Quality Review

## Purpose
Keep the framework professional: every merged test is reliable, readable, traceable and safe.

## When to use
- Before merging any PR; after refactoring Codegen output; periodic framework health checks.

## Required inputs
- The diff, the latest run output and `reports/coverage/ac-coverage.md`.

## Step-by-step workflow
1. **Static**: `npm run typecheck`; grep for forbidden patterns:
   `rg "waitForTimeout|test\.only|force: true|onrender\.com" tests pages` (URLs only allowed in config/env + docs).
2. **Structure**: specs import from `fixtures/test.ts`; locators only in `pages/`; HTTP only through `TaskApiClient`.
3. **Traceability**: every test has `trace()`; every covered AC has a `verifyAC`; test case in catalogue; no coverage warnings.
4. **Data**: unique titles, cleanup paths for create/adopt/forget, no seed-data dependency.
5. **Assertions**: business outcomes, explicit status codes, schema checks, expected vs actual meaningful.
6. **Stability**: `npx playwright test <changed specs> --repeat-each=3 --workers=4`.
7. **Security**: no secrets/PII in code, fixtures, evidence, or Jira payloads.
8. **Honesty**: PR description quotes real run output; skipped steps are stated.

## Rules and constraints
- Block merge on: sleeps, missing cleanup, invented endpoints/selectors, tag-only coverage, fabricated results.

## Expected outputs
- Review notes: blocking issues, suggestions, verified run evidence.

## Verification checklist
- [ ] Typecheck clean, tests pass 3× in a row.
- [ ] No leftover `TPW-*` data.
- [ ] Coverage matrix unchanged or improved, warnings empty.
