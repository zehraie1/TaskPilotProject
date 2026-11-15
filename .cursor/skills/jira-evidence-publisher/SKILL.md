---
name: jira-evidence-publisher
description: Publish an approved, sanitized, de-duplicated execution summary, AC coverage, screenshots and CI links to the source Jira story.
---
# Jira Evidence Publisher

## Purpose
Close the traceability loop: the story in Jira shows what was tested, the result, and where the evidence is.

## When to use
- After a meaningful run (e.g. CI on main) when the team explicitly approves publishing.

## Required inputs
- `reports/coverage/ac-coverage.json` from a real run.
- Connected Jira credentials + `JIRA_PUBLISH_ENABLED=true` (for real publishing).

## Step-by-step workflow
1. Dry run (default, safe): `npm run jira:publish -- TP-101` → prints comment preview + attachment list; writes `reports/jira/TP-101-<run>.dry-run.json`.
2. Review the preview with the QA lead.
3. Publish: `JIRA_PUBLISH_ENABLED=true npm run jira:publish -- TP-101 --approve` (or `--all`).
4. Publisher: locates story → checks comments for run marker → posts ADF comment (summary, AC table, test case ids, failures, CI/commit links) → uploads coverage HTML + ≤3 PNG screenshots unless same filename exists → adds idempotent remote link to CI run.
5. Result recorded in `reports/jira/<KEY>-<run>.published.json`.

## Rules and constraints
- Never publish without both approvals; never publish invented numbers.
- No videos/traces/raw logs to Jira; all text sanitized.
- Jira cannot render HTML inline — attach as file and link the CI artifact.
- Re-running the same run must not duplicate comments/attachments.

## Expected outputs
- One comment + attachments + remote link per story per run, or a dry-run record.

## Verification checklist
- [ ] Dry run reviewed before publishing.
- [ ] Second publish of the same run reports `skipped-duplicate`.
- [ ] Comment contains no secrets/PII.
