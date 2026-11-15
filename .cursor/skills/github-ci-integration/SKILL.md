---
name: github-ci-integration
description: Run TestPilot PW in GitHub Actions with type checking, tests, artifacts, job summaries and an optional, explicitly approved Jira publishing job.
---
# GitHub CI Integration

## Purpose
Execute the suite automatically on every change and keep evidence available to everyone.

## When to use
- Setting up or modifying `.github/workflows/playwright.yml`.

## Required inputs
- GitHub repository; optional secrets `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`; optional variables `UI_BASE_URL`, `API_BASE_URL`.

## Step-by-step workflow
1. Triggers: push/PR to `main`, nightly schedule, `workflow_dispatch` (inputs: suite, evidence, publish_to_jira).
2. Job `test`: checkout → setup-node 24 (npm cache) → `npm ci` → `npx playwright install --with-deps chromium` → `npm run typecheck` → `npx playwright test` → job summary → upload `reports/` + `test-results/` (`if: always()`).
3. Job `publish-jira`: runs only on `workflow_dispatch` with `publish_to_jira: true`, uses environment `jira` (configure required reviewers), downloads the report artifact and runs `npm run jira:publish -- --all --approve`.
4. Check results in the Actions tab; download `testpilot-reports-<run>` artifact; open `reports/html/index.html`.

## Rules and constraints
- Secrets via `${{ secrets.* }}` only; never echo them.
- `forbidOnly` is enforced in CI; retries=1 so traces exist for failures.
- Jira publishing never runs by default.

## Expected outputs
- Green/red check per commit, artifacts, job summary with AC coverage.

## Verification checklist
- [ ] Workflow validated by a real run on GitHub (record run URL).
- [ ] Artifacts uploaded even when tests fail.
- [ ] Publish job skipped unless explicitly requested.
