# AGENTS.md — TestPilot PW

Instructions for AI coding agents (Cursor, Claude Code, Copilot) working in this repository.

## Mission
TestPilot PW is an **independent** Playwright + TypeScript automation framework for the TaskPilot application
(React/Vite UI, FastAPI API, PostgreSQL). It never modifies TaskPilot. Lifecycle:

`Jira Story → Requirements Analysis → Test Cases → UI/API/Hybrid Automation → Step Assertions → Evidence → Reports → Jira → GitHub CI`

## System under test (verified 2026-11-15)
| | |
|---|---|
| UI | `UI_BASE_URL` (default https://taskpilot-web.onrender.com) — routes `/`, `/tasks`, `/tasks/:taskId` |
| API | `API_BASE_URL` (default https://taskpilot-api-k11v.onrender.com) — contract at `/openapi.json` |
| Auth | none |
| Database | **shared** with every workshop participant — never assume fixed data |

Endpoints: `GET /health`, `GET|POST /api/v1/tasks`, `GET|PATCH|DELETE /api/v1/tasks/{uuid}`, `GET /api/v1/dashboard/summary`.
Errors use `{"error":{"code","message","details"}}` (404 `not_found`, 422 `validation_error`) — this differs from the OpenAPI doc; see `docs/api-contract-findings.md`.

## Non-negotiable rules
1. **Verify before you write.** Never invent endpoints, fields, selectors or messages. Check `/openapi.json`, the live UI (Codegen / aria snapshot) or existing page objects first.
2. **Import `test`/`expect` from `fixtures/test.ts`**, never directly from `@playwright/test` in specs.
3. **Every test owns its data**: create via `tasks.create()` (or `tasks.adoptByTitle()` for UI-created data); titles from `uniqueTitle()`. Cleanup is automatic — never leave data behind.
4. **No sleeps.** `waitForTimeout` is forbidden in tests. Use web-first assertions, `expect.poll`, `waitForResponse` or `page.route`.
5. **Locators**: `getByRole` / `getByLabel` first, `getByTestId` for existing `data-testid`s, CSS/XPath only as a documented last resort. Locators live in `pages/`, not specs.
6. **Traceability**: every test uses `trace({ testCase, covers })`; every business assertion lives inside `verifyAC(ac, step, expected, body)`. A tag alone is NOT coverage.
7. **Honesty**: never claim tests passed, coverage numbers or Jira/CI success unless produced by an actual run. Report failures with their output.
8. **Secrets**: never hard-code or log credentials; Jira credentials come from `.env` / GitHub Secrets; evidence passes through `utils/sanitize.ts`.
9. **Jira writes are opt-in**: `npm run jira:publish` is a dry run unless `JIRA_PUBLISH_ENABLED=true` **and** `--approve` are both present.
10. **Minimal dependencies**: do not add packages without justification (current: @playwright/test, typescript, ajv, ajv-formats, dotenv, @types/node).

## Project map
```
tests/{api,ui,hybrid,codegen}  specs            pages/         page objects (POM)
fixtures/                      test + factory   clients/       TaskApiClient (APIRequestContext)
schemas/                       Ajv JSON schemas utils/         test data, traceability, evidence, sanitize
integrations/jira/             reader, analyzer, generator, publisher (+ cli/)
reporting/                     AC coverage reporter  config/   env, global setup/teardown
data/jira/                     Jira fixtures    data/test-cases/catalogue.json  approved test cases
.cursor/rules/ .cursor/skills/ AI guidance      docs/          training documentation + diagrams
```

## Commands
```bash
npm run typecheck          # must pass before any commit
npm test                   # api + chromium projects
npm run test:api | test:ui | test:hybrid | test:smoke
npm run test:evidence      # full screenshots/video/trace
npm run codegen            # record a flow (then refactor!)
npm run jira:read -- TP-101 ; npm run jira:generate -- TP-101 ; npm run jira:publish -- TP-101
npm run report             # open the Playwright HTML report
```

## Skills
Use the matching skill in `.cursor/skills/<name>/SKILL.md`:
jira-story-reader · requirements-analysis · test-case-generator · playwright-codegen · page-object-model ·
ui-automation · api-automation · hybrid-testing · assertion-traceability · test-data-management ·
evidence-capture · html-reporting · jira-evidence-publisher · github-ci-integration · automation-quality-review

## Definition of done for any change
`npm run typecheck` passes · affected specs executed and passing (show real output) · new tests are in
`data/test-cases/catalogue.json` · no new coverage warnings in `reports/coverage/ac-coverage.md` · no leftover `TPW-*` data.
