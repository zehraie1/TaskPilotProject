# Cursor Development Master Prompt & Milestones

## Master prompt (paste into Cursor Agent)
```
You are working in TestPilot PW, a Playwright + TypeScript automation framework for the TaskPilot app.
Read AGENTS.md and the relevant .cursor/skills/*/SKILL.md before acting.

Task: automate Jira story <KEY>.
1. jira-story-reader: run `npm run jira:read -- <KEY>`; summarize ACs and findings.
2. requirements-analysis: list ambiguities and questions; STOP if there is a blocker.
3. test-case-generator: run `npm run jira:generate -- <KEY>`, enrich the drafts to include all 10 fields,
   and show them to me for review. Do not write code until I approve.
4. After approval: add cases to data/test-cases/catalogue.json.
5. Inspect the real UI/API (OpenAPI, aria snapshot, existing page objects). Never invent selectors or endpoints.
6. Implement specs following page-object-model, ui-automation, api-automation, hybrid-testing,
   assertion-traceability and test-data-management skills.
7. Run `npm run typecheck` and the new specs with `--repeat-each=3`; paste the real output.
8. Show reports/coverage/ac-coverage.md for <KEY>. Do not publish to Jira unless I explicitly say so.
9. Finish with automation-quality-review and list anything not verified.
```

## Implementation milestones (workshop plan)
| # | Milestone | Deliverable | Done when |
|---|---|---|---|
| M1 | Scaffold | package.json, tsconfig, playwright.config, .env.example | `npm run typecheck` passes |
| M2 | Explore SUT | OpenAPI review, aria snapshots, contract findings | `docs/api-contract-findings.md` |
| M3 | API layer | TaskApiClient, schemas, factory, API specs | `npm run test:api` green |
| M4 | UI layer | page objects, fixtures, UI specs | `npm run test:ui` green |
| M5 | Codegen | record → refactor exercise | TC-CG-001 green 3× |
| M6 | Hybrid | scenarios A–E | `npm run test:hybrid` green |
| M7 | Traceability | trace/verifyAC, coverage reporter, catalogue | AC matrix with no warnings |
| M8 | Jira | reader, analyzer, generator, publisher (dry run) | fixture mode end-to-end |
| M9 | Evidence & reports | evidence policy, failure demo | screenshot/video/trace verified |
| M10 | CI | GitHub Actions + artifacts | green run on GitHub |
| M11 | AI enablement | AGENTS.md, rules, 15 skills | review checklist passes |
