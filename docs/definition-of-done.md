# Definition of Done — status

Status reflects what was **actually executed** on 2026-11-15 against the hosted TaskPilot. Re-check before each workshop.

| Criterion | Status | Evidence |
|---|---|---|
| UI tests execute successfully | ✅ Verified | 15/15 passed (chromium) |
| API tests execute successfully | ✅ Verified | 35/35 passed |
| Hybrid tests execute successfully | ✅ Verified | 5/5 passed (+ codegen refactor 1/1) |
| Full suite | ✅ Verified | 56/56 passed in one `npx playwright test` run (35 api + 21 chromium), 0 flaky, ~22 s |
| Stability | ✅ Verified | chromium projects `--repeat-each=3` with 4 workers: 63/63 passed |
| Cleanup | ✅ Verified | `GET /api/v1/tasks?search=TPW-` → total 0 after every run |
| Codegen works | ⚠️ Partially | `scripts/codegen.mjs` + refactored spec verified; interactive recording needs a headed session by the user |
| Page objects reusable | ✅ | Used across UI, hybrid and codegen specs |
| Assertions validate business outcomes | ✅ | `verifyAC` steps with expected/actual in coverage report |
| Screenshots, videos, traces per configuration | ✅ Verified | failure demo + full-evidence run |
| HTML reports generated | ✅ Verified | `reports/html`, junit, json, coverage |
| AC coverage traceable | ✅ Verified | 20/21 ACs Passed, TP-105:AC3 Not automated (ambiguous) |
| Jira fixture mode works | ✅ Verified | read, generate, dry-run publish |
| Connected Jira mode verified | ✅ Verified | TAS project: epic TAS-1, stories TAS-2…TAS-17, 45 linked test cases with evidence (see docs/jira-integration.md) |
| CI workflow validated | ⚠️ Partially | YAML parses; not yet run on GitHub |
| Cross-browser (Firefox/WebKit) | ✅ Verified | UI + hybrid: 40/40 passed (20 per browser) |
| Headed mode | ✅ Verified | UI + hybrid 20/20 headed in Chromium; `npm run demo:create-tasks` created 3 persistent demo tasks via UI |
| Documentation complete | ✅ | README, docs/, AGENTS.md, rules, 15 skills |
