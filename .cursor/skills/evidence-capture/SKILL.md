---
name: evidence-capture
description: Configure and capture screenshots, videos, traces and sanitized API evidence according to the evidence policy.
---
# Evidence Capture

## Purpose
Provide enough proof to understand any result — without leaking secrets or bloating reports.

## When to use
- Configuring evidence, preparing demos, investigating failures.

## Required inputs
- `playwright.config.ts`, `utils/evidence.ts`, `EVIDENCE` env var.

## Step-by-step workflow
1. Standard policy (`EVIDENCE=standard`): screenshot `only-on-failure`, video `retain-on-failure`, trace `on-first-retry` (retries=1 in CI).
2. Full policy (`npm run test:evidence`): screenshot, video and trace `on` for every test.
3. Step screenshots: `await stepScreenshot(page, 'name')` (full mode) or `stepScreenshot(page, 'name', true)` (always).
4. API evidence: `TaskApiClient` logs every exchange; `apiLog` fixture attaches sanitized `api-exchanges.json` on failure or in full mode.
5. Open a trace: `npx playwright show-trace test-results/<test>/trace.zip` or via the HTML report.
6. Evidence paths are listed per test in `reports/coverage/failure-summary.md`.

## Rules and constraints
- Everything leaving the machine passes `sanitize()` (tokens, auth headers, emails redacted).
- Avoid full-page screenshots of lists containing other users' data unless needed; scope to the relevant area.
- Videos/traces are CI artifacts only — never uploaded to Jira.

## Expected outputs
- `test-results/**` (png, webm, trace.zip), attachments in HTML report.

## Verification checklist
- [ ] Failing test has screenshot + video; retry has trace.
- [ ] `api-exchanges.json` contains no secrets.
- [ ] Full mode produces step screenshots for UI flows.
