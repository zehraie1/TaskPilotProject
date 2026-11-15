---
name: html-reporting
description: Generate and interpret Playwright HTML, JUnit, JSON reports plus AC coverage, execution and failure summaries from real results.
---
# HTML Reporting

## Purpose
Communicate real execution results to engineers, QA leads and stakeholders.

## When to use
- After every run; when preparing CI artifacts or Jira evidence.

## Required inputs
- A completed Playwright run.

## Step-by-step workflow
1. Reporters configured in `playwright.config.ts`: list, html (`reports/html`), junit (`reports/junit/results.xml`), json (`reports/json/results.json`), custom AC coverage (`reports/coverage`).
2. Open HTML: `npm run report`. Filter by tag (`@TP-101`, `@smoke`), inspect steps `[TP-101:AC1] …`, attachments and traces.
3. Read `reports/coverage/ac-coverage.html` (matrix), `execution-summary.md`, `failure-summary.md`.
4. In CI, `execution-summary.md` is also appended to the GitHub job summary.

## Rules and constraints
- Use actual execution results only; never edit report files by hand.
- Distinguish *Not executed* (automated but not run) from *Not automated* (no test).
- Report flaky tests (passed on retry) explicitly.

## Expected outputs
- Complete `reports/` folder; links shared from CI artifacts.

## Verification checklist
- [ ] Numbers in summaries match the HTML report.
- [ ] Every failed test lists evidence paths.
- [ ] Reports are git-ignored, uploaded as CI artifacts.
