# Evidence Configuration

| Setting | `EVIDENCE=standard` (default) | `EVIDENCE=full` (`npm run test:evidence`) |
|---|---|---|
| Screenshot | only on failure | every test (end state) |
| Step screenshots (`stepScreenshot`) | only where `force=true` | all checkpoints |
| Video | retained on failure | every test |
| Trace | on first retry (CI retries = 1) | every test |
| API exchanges (`api-exchanges.json`) | on failure | every test |

Locations: `test-results/<test>/` (png, webm, trace.zip, error-context.md) and attachments inside `reports/html`.
Open a trace: `npx playwright show-trace test-results/<test>/trace.zip`.

**Sanitization** (`utils/sanitize.ts`): redacts `authorization`, `cookie`, `token`, `password`, `secret`, `api_key`, `email` keys, Bearer/Basic values, e-mail addresses and Atlassian API tokens. Applied to API evidence and all Jira payload text.

**Verified on 2026-11-15:** a deliberately failing UI test produced screenshot + video (attempt 1), screenshot + video + trace (retry #1), `api-exchanges.json`, a *Failed* AC in the matrix and a failure summary with evidence paths; full mode on TC-HYB-005 produced step screenshot, end screenshot, API log, video and trace.
