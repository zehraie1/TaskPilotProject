# Jira Integration

## Modes
| `JIRA_MODE` | Source | Needs network/credentials |
|---|---|---|
| `fixture` (default) | `data/jira/<KEY>.json` | No |
| `connected` | `GET {JIRA_BASE_URL}/rest/api/3/issue/{KEY}` | Yes: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |

Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens and put it ONLY in `.env` or GitHub Secrets.

## 1. Story pickup
```bash
npm run jira:read -- TP-101                    # fixture mode
npm run jira:read -- TP-101 --mode connected   # real Jira
```
Prints user story, ACs (`TP-101:AC1…`) and findings; caches `generated/stories/TP-101.json`.

## 2. Test case generation
```bash
npm run jira:generate -- TP-101
```
Writes `generated/test-cases/TP-101.draft.{json,md}` with traceability (AC → test case ids). Enrich with the `test-case-generator` skill, review, then promote approved cases to `data/test-cases/catalogue.json`.

## 3. Report publishing
```bash
npm run jira:publish -- TP-101               # dry run (default)
JIRA_PUBLISH_ENABLED=true JIRA_MODE=connected npm run jira:publish -- TP-101 --approve
npm run jira:publish -- --all                # every story with executed ACs
```
Publishes: ADF comment (result, AC table, executed test cases, failures, CI run + commit link, run marker), `ac-coverage.html` (Jira cannot render HTML inline → attached as a file) + up to 3 screenshots, and an idempotent remote link to the CI run.
Duplicates are avoided via the run marker (comments), run-specific file names (attachments) and `globalId` (remote link).
Each execution writes `reports/jira/<KEY>-<run>.<dry-run|published>.json`.

## 4. Story & test case sync (Jira project TAS)
```bash
npm run jira:sync                # dry run: story plan + AC results from the last run
npm run jira:sync -- --approve   # create/update epic, stories, test cases, links, evidence
```
- Plan: `integrations/jira/tas-story-plan.ts` (16 user stories, each AC mapped to framework AC refs + test cases).
- Test cases: one Jira **Task** per entry in `data/test-cases/catalogue.json`, linked to its stories with **Relates**, parented to the epic.
- Evidence: per story — evidence comment + step-level `S0x-<run>-test-evidence.md` + UI screenshots; per test case — `TC-…-test-evidence.md` + screenshots (UI) or Jira-safe API evidence (other users' records from the shared DB removed); epic — coverage HTML, execution summary, JUnit XML.
- Idempotent: issues matched by label `tpw-key-<id>`, attachments by file name, comments by run marker, links checked before creation.
- Mapping written to `data/jira/tas-issue-map.json`.

## Verification status (2026-11-15)
- Fixture mode: **verified** (read, generate, coverage registry, dry-run publish).
- Connected mode: **verified** against `zehraie1976.atlassian.net`, project TAS — sync created 62 issues (1 epic, 16 stories, 45 test cases), 77 links, 135 attachments, 16 evidence comments from run `261115152515qh7` (96/96 passed); re-run produced 0 duplicates.
- `jira:publish` (TP-keyed publisher) still targets fixture story keys; use `jira:sync` for the TAS project.
