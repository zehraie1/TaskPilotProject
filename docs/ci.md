# GitHub Actions

Workflow: `.github/workflows/playwright.yml`

| Trigger | What runs |
|---|---|
| push / PR to `main` | typecheck + full suite (api + chromium) |
| weekdays 06:00 UTC | same (detects environment drift) |
| manual (`workflow_dispatch`) | choose `suite` (all/api/ui/hybrid/smoke), `evidence` (standard/full), optional `publish_to_jira` |

## Setup
1. Push this repository to GitHub.
2. *(Optional)* Repository **Variables**: `UI_BASE_URL`, `API_BASE_URL` (defaults: hosted TaskPilot).
3. *(Optional, Jira)* Repository **Secrets**: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
4. *(Optional, Jira)* Settings → Environments → create **`jira`** with *Required reviewers* — this is the explicit approval gate.

## Outputs
- Job summary: execution summary + AC coverage matrix.
- Artifact `testpilot-reports-<run_id>`: HTML, JUnit, JSON, coverage (always uploaded).
- Artifact `testpilot-evidence-<run_id>`: screenshots, videos, traces (on failure).
- Artifact `testpilot-jira-publish-<run_id>`: publishing record (only when publishing ran).

## Validation status (2026-11-15)
YAML syntax parsed locally; the workflow has **not yet been executed on GitHub** (no remote repository). After the first push, record the run URL here.
