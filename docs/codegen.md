# Playwright Codegen Workflow

## 1. Launch
```bash
npm run codegen                          # records against UI_BASE_URL (hosted TaskPilot by default)
npm run codegen -- http://localhost:5173 # local TaskPilot
npx playwright codegen http://localhost:5173   # plain Playwright command
```
`scripts/codegen.mjs` adds `--test-id-attribute data-testid`, a fixed viewport and saves to `generated/codegen/recording-<timestamp>.spec.ts` (git-ignored).

## 2. Record
1. Perform the flow exactly as in the approved test case.
2. Use **Pick locator** (target icon) to inspect what Codegen proposes; prefer role/label/test-id.
3. Use the toolbar **Assert visibility / text / value** buttons at checkpoints.
4. Close the browser → the file is written.

## 3. Review checklist (see `docs/codegen/recorded-create-task.raw.ts`)
| ❌ Raw recording | ✅ Refactored |
|---|---|
| `test('test', …)` | Behaviour title + `trace({ testCase, covers })` |
| `page.goto('https://…')` | `page.goto('/')` / page object `goto()` (baseURL from config) |
| Locators inline | Locators in `pages/*` |
| `click()` then `fill()` | `fill()` only |
| Literal data `'My demo task'` | `buildTask()` / `uniqueTitle()` |
| No/weak assertions | `verifyAC()` with business assertions |
| No cleanup | `tasks.adoptByTitle()` registers cleanup |

## 4. Integrate
Move the refactored spec to `tests/<layer>/`, add the test case to `data/test-cases/catalogue.json`, then:
```bash
npx playwright test tests/codegen --project=chromium --repeat-each=3
```
Reference result: `tests/codegen/create-task.refactored.spec.ts` (TC-CG-001).
