---
name: api-automation
description: Write Playwright APIRequestContext tests for the TaskPilot REST API with status, schema, business, negative and boundary validation.
---
# API Automation

## Purpose
Verify the business rules and contract of the TaskPilot API quickly and precisely.

## When to use
- Automation Type = API; validation rules, error handling, limits, data persistence.

## Required inputs
- Live OpenAPI (`${API_BASE_URL}/openapi.json`), approved test cases, schemas in `schemas/`.

## Step-by-step workflow
1. Confirm the endpoint, params and limits in OpenAPI; probe real behaviour for undocumented responses (e.g. 404).
2. Add/extend methods in `clients/task-api-client.ts` (typed, logged).
3. Write `tests/api/<resource>.api.spec.ts` with `trace()` + `verifyAC()`.
4. Assertion order: **status → schema (`expectSchema`) → business values → persistence (GET again)**.
5. Negative: invalid enum, wrong type, missing required, unknown id (404), malformed id (422).
6. Boundary: data-driven arrays (title 1/120/121, description 2000/2001, limit 0/1/100/101).
7. For negative POSTs that unexpectedly succeed, still `tasks.track(id)` so cleanup happens.
8. Run `npm run test:api`.

## Rules and constraints
- No fixed DB assumptions (totals change constantly); assert relative/internal consistency.
- Schema files: `additionalProperties: false` for responses; record deviations in docs.
- Never log or attach auth headers (client evidence is sanitized).

## Expected outputs
- Passing API specs; `api-exchanges.json` evidence on failure / full mode.

## Verification checklist
- [ ] Positive, negative, boundary present per AC where applicable.
- [ ] Every response validated against a schema.
- [ ] Data cleaned up (verify `GET /api/v1/tasks?search=TPW-` returns none after run).
