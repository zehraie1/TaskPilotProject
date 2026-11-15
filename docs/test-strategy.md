# Test Strategy — TestPilot PW

## 1. Scope
**In scope:** dashboard metrics & recent activity, task create / edit / status change / delete, search, status filter, pagination, task details, loading & error states, all 7 API endpoints.
**Out of scope:** TaskPilot code changes, performance/load, security penetration, visual regression, accessibility audit (semantic locators give partial a11y signal only).

## 2. Requirements (Jira stories, fixture mode)
| Story | Summary | ACs | Notes |
|---|---|---|---|
| TP-101 | Create a task | 4 | title rules, optional fields, list visibility |
| TP-102 | Find and view tasks | 5 | search, filter, empty state, pagination, details |
| TP-103 | Update a task and track progress | 4 | edit, status, invalid updates, timestamps |
| TP-104 | Delete a task | 3 | confirmation, removal, not found |
| TP-105 | Dashboard overview | 3 | **AC3 deliberately ambiguous** ("fast", "user-friendly") to demonstrate requirements analysis |
| TP-106 | Loading and error feedback | 2 | loading indicator, API-down message + retry |

Source files: `data/jira/TP-10x.json` (Jira REST v3 format, ADF descriptions). Read them with `npm run jira:read -- TP-101`.

## 3. Test levels and layer selection
| Question | Layer |
|---|---|
| Is it a validation rule, limit, status code or persistence rule? | **API** (fast, precise) |
| Is it something the user must see or do? | **UI** |
| Must the UI and backend agree? | **Hybrid** |
| Is the expected result not measurable yet? | **Manual / blocked** until clarified |

## 4. Test design techniques
- **Equivalence partitioning**: valid vs invalid enum values (status, priority), valid vs malformed ids/dates.
- **Boundary value analysis**: title 1/120/121, description 2000/2001, page size 0/1/100/101.
- **State transition**: pending → in_progress → completed → pending.
- **Error guessing**: whitespace-only title, deleting twice, unknown UUID, network failure.
- **Consistency checks** instead of absolute numbers on the shared DB (dashboard sums, captured responses).

## 5. Test data strategy
Unique `TPW-<runId>-w<worker>-<hex>` titles, API-based arrange, fixture teardown + global prefix sweep. No dependency on seed data. Details: `.cursor/skills/test-data-management/SKILL.md`.

## 6. Entry / exit criteria
- **Entry**: `/health` = ok (global setup waits up to `HEALTH_TIMEOUT_SECONDS`), approved test cases.
- **Exit**: typecheck clean; all automated tests pass (or failures triaged with evidence); AC matrix has no *Failed* ACs; only justified *Not automated* ACs; zero leftover data.

## 7. Risks
| Risk | Mitigation |
|---|---|
| Render cold start | global health polling, generous navigation timeout |
| Shared DB concurrency | unique data, scoped searches, captured responses, presence (not position) assertions |
| Recent-activity crowding by other users | `test.skip` with explicit reason in TC-UI-002 if the task is pushed out |
| Contract drift (OpenAPI ≠ live) | schema tests + `docs/api-contract-findings.md` |
| Third-party user content in screenshots | screenshots scoped, no videos/traces published to Jira |

## 8. Traceability model
`Story → AC (TP-101:AC1) → Test case (catalogue.json) → Spec (trace) → verifyAC step → Coverage matrix → Jira comment`.
Coverage statuses: **Passed**, **Failed**, **Not executed**, **Not automated** — computed from executed AC assertion steps only.
