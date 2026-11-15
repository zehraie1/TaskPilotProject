---
name: requirements-analysis
description: Detect missing, ambiguous or untestable requirements in a normalized Jira story before test design.
---
# Requirements Analysis

## Purpose
Catch weak acceptance criteria early so tests verify real, measurable behaviour — "shift-left" quality.

## When to use
- Immediately after `jira-story-reader`.
- Before generating or approving test cases.
- When a test is hard to write because "expected result" is unclear.

## Required inputs
- NormalizedStory (from `npm run jira:read -- <KEY>`).
- Access to the live UI/API to compare the story with reality.

## Step-by-step workflow
1. Review automatic findings from `integrations/jira/requirements-analyzer.ts`:
   `missing-acceptance-criteria` (blocker), `ambiguous-term`, `no-observable-outcome`, `weak-modal-verb`, `too-short`, `open-question`.
2. For each AC, ask: *Who acts? What input? What observable result? Which channel (UI/API)?*
3. Compare with the actual product (OpenAPI, UI). Record mismatches (e.g. error envelope differs from OpenAPI).
4. Identify boundaries (lengths, ranges, enums) and negative paths not stated in the AC.
5. Write questions for the Product Owner; propose measurable rewrites
   (e.g. "load fast" → "dashboard metrics visible within 2 s on a warm server").
6. Classify each AC: Ready · Needs clarification · Not testable.

## Rules and constraints
- Do not invent business rules; propose them as questions.
- Blockers stop test generation (`jira:generate` exits non-zero).
- Ambiguous ACs may be automated only after clarification; meanwhile mark them `Manual`/blocked in the catalogue.

## Expected outputs
- Findings table per AC with severity and a suggested clarification.
- Updated AC readiness list.

## Verification checklist
- [ ] Every AC has an observable, verifiable outcome or an open question.
- [ ] Boundaries and enums listed from the real contract.
- [ ] Product deviations documented in `docs/api-contract-findings.md`.
- [ ] TP-105 AC3-style vague criteria are flagged, not silently automated.
