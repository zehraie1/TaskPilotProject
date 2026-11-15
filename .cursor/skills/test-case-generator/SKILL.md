---
name: test-case-generator
description: Convert a normalized Jira story into reviewed positive, negative and boundary test cases (UI, API, hybrid) with full traceability fields.
---
# Test Case Generator

## Purpose
Produce complete, reviewable test cases that map 1:N from acceptance criteria — the bridge between requirements and code.

## When to use
- After requirements analysis, before writing any spec.
- When adding coverage for a new or changed AC.

## Required inputs
- Issue key with no blocker findings.
- Knowledge of the real UI/API (selectors, endpoints, limits).

## Step-by-step workflow
1. `npm run jira:generate -- <KEY>` → rule-based drafts in `generated/test-cases/<KEY>.draft.{json,md}`.
2. Enrich each draft (AI-assisted) so it contains ALL fields:
   Test Case ID · Jira Story Key · Acceptance Criterion ID · Scenario Title · Preconditions · Test Data ·
   Steps · Expected Results · Automation Type (UI/API/Hybrid/Manual) · Priority (P1–P3).
3. Ensure a mix per AC: positive; negative where invalid input is possible; boundary for every numeric/length limit.
4. Pick the cheapest reliable layer: rules/validation → API; user-visible behaviour → UI; cross-channel consistency → Hybrid.
5. Use ID convention `TC-API-0NN`, `TC-UI-0NN`, `TC-HYB-0NN`, `TC-MAN-0NN`.
6. **Human review**: QA lead sets `status: approved` (or `rejected` with notes).
7. Promote approved cases to `data/test-cases/catalogue.json` with `automated` + `spec`.

## Rules and constraints
- Test cases must be reviewed before code generation — no exceptions.
- Expected results must be observable and specific (status codes, texts, values).
- Do not create cases for behaviour that does not exist in the product.
- Ambiguous ACs → `Manual`, `automated: false`, blocked note.

## Expected outputs
- Draft files in `generated/test-cases/`.
- Approved entries in `data/test-cases/catalogue.json`.

## Verification checklist
- [ ] Every AC has ≥ 1 approved case (or an explicit "not automated" reason).
- [ ] All 10 mandatory fields filled.
- [ ] Boundaries use min-1/min/max/max+1.
- [ ] IDs unique and referenced by `trace({ testCase })` in specs.
