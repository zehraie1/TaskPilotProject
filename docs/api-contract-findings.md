# API Contract Findings

Verified against the live service on **2026-11-15** (`https://taskpilot-api-k11v.onrender.com`, OpenAPI "TaskPilot API" v0.1.0).
Tests encode the **observed** behaviour; deviations from the OpenAPI document are listed here so they can be raised with the API team instead of being silently "fixed" in tests.

| # | Area | OpenAPI says | Live service does | Impact on tests | Suggested action |
|---|---|---|---|---|---|
| 1 | Error body (422) | `HTTPValidationError { detail: ValidationError[] }` | `{ "error": { "code": "validation_error", "message": "Request validation failed", "details": [...] } }` | `schemas/error.schema.json` models the observed envelope | Update OpenAPI `responses` to the real envelope |
| 2 | Not found | No 404 documented for `GET/PATCH/DELETE /tasks/{id}` | `404 { "error": { "code": "not_found", "message": "Task not found", "details": [] } }` | 404 tests assert observed code | Document 404 responses |
| 3 | Whitespace title | `minLength: 1` only | `"   "` rejected with 422 ("Title must contain at least one non-whitespace character") | TC-API-013 / TC-UI-011 assert rejection | Document the trim rule |
| 4 | Response optionality | `status`, `priority`, `description`, `due_date` optional in `TaskRead` | Always present (nullable) | Response schema marks them required | Mark as required in `TaskRead` |
| 5 | Extra endpoint | — | `GET /api/v1/dashboard/summary` exists (documented) but not in the original workshop brief | Covered by TC-API-050/051, TC-UI-001/002 | — |
| 6 | Completion | Brief mentions "task completion" | No dedicated endpoint; completion = `PATCH {status:"completed"}` | Scenario D uses PATCH | — |
| 7 | HEAD requests | — | `HEAD /api/v1/tasks` → 405 | Not used | — |

## UI observations
- Delete confirmation is a native `window.confirm("Delete “<title>”? This action cannot be undone.")` — handled with `page.once('dialog')`.
- Existing `data-testid`s: `create-task`, `header-create-task`, `task-form`, `save-task`, `task-status`, `search-tasks`, `status-filter`, `sort-tasks`, `delete-task-detail`.
- Error state: heading "We couldn’t load this page" + message + "Try again" button; network failure message "Unable to connect to the TaskPilot API."
- The shared database contains free-text entries from other workshop users; avoid full-page screenshots in published evidence.
