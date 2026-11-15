---
name: assertion-traceability
description: Attach test case, Jira story and AC metadata to tests and record step-level expected/actual/pass-fail results for the AC coverage matrix.
---
# Assertion Traceability

## Purpose
Make coverage measurable: an AC is covered only when an assertion step for it actually executed and passed.

## When to use
- Every new or modified test.
- Investigating coverage warnings or "Not executed" ACs.

## Required inputs
- Approved test case id and the AC refs it covers.

## Step-by-step workflow
1. Declare metadata: `test(title, trace({ testCase: 'TC-UI-010', covers: ['TP-101:AC3', 'TP-101:AC4'], tags: ['@smoke'] }), ...)`.
   This adds tags (`@TP-101 @TC-UI-010`) and annotations (`testcase`, `story`, `ac`).
2. Wrap each meaningful validation:
   ```ts
   await verifyAC('TP-101:AC4', 'Submit the form; task appears', 'row visible', async () => {
     await form.save(); await tasksPage.expectTaskVisible(title); return 'row visible';
   });
   ```
3. `verifyAC` creates a `test.step` titled `[TP-101:AC4] …` and records Test ID, Story, AC, step, expected, actual, status, evidence names.
4. `reporting/ac-coverage-reporter.ts` builds the matrix: Passed / Failed / Not executed / Not automated, and warns when a test is tagged with an AC but never executed a step for it.
5. Read `reports/coverage/ac-coverage.md|html`.

## Rules and constraints
- Every `verifyAC` body MUST contain at least one assertion.
- Return a short, factual *actual* value (status code, count, text) — never a copy of "expected" when you can observe something real.
- `covers` must only list ACs that have a `verifyAC` in the test.

## Expected outputs
- Step-level records in the HTML report and coverage JSON.

## Verification checklist
- [ ] No "tagged but no verifyAC step" warnings.
- [ ] Test case id exists in the catalogue.
- [ ] Failure shows expected vs actual in `failure-summary.md`.
