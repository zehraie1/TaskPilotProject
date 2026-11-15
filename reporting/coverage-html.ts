/**
 * Renders the AC coverage matrix as a self-contained HTML page (no external assets),
 * so it can be uploaded to CI artifacts or attached to Jira as a single file.
 */
import type { CoverageReport } from './ac-coverage-reporter.ts';

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const CLASS: Record<string, string> = { Passed: 'pass', Failed: 'fail', 'Not executed': 'skip', 'Not automated': 'none' };

export function renderCoverageHtml(r: CoverageReport): string {
  const t = r.totals;
  const tile = (label: string, value: number | string, cls: string) =>
    `<div class="tile ${cls}"><span class="v">${value}</span><span class="l">${label}</span></div>`;
  const rows = r.rows
    .map((x) => `<tr>
      <td class="mono">${esc(x.ref)}</td>
      <td><span class="badge ${CLASS[x.status]}">${x.status}</span></td>
      <td>${x.covered ? 'Yes' : 'No'}</td>
      <td class="mono">${x.testCases.map(esc).join('<br>') || '—'}</td>
      <td class="num">${x.passedSteps} / ${x.failedSteps}</td>
      <td>${esc(x.text)}${x.findings.length ? `<div class="finding">${x.findings.map(esc).join('<br>')}</div>` : ''}</td>
    </tr>`)
    .join('');
  const tests = r.tests
    .filter((x) => x.status !== 'not-run')
    .sort((a, b) => a.testCase.localeCompare(b.testCase))
    .map((x) => `<tr>
      <td class="mono">${esc(x.testCase)}</td><td>${esc(x.project)}</td>
      <td><span class="badge ${x.status === 'passed' ? 'pass' : x.status === 'skipped' ? 'skip' : 'fail'}">${x.status}</span></td>
      <td>${esc(x.title)}${x.error ? `<div class="finding">${esc(x.error)}</div>` : ''}</td>
      <td>${x.acSteps.map((s) => `<div class="step ${s.status === 'passed' ? 'ok' : 'ko'}"><b>${esc(`${s.story}:${s.ac}`)}</b> ${esc(s.step)}<br><small>Expected: ${esc(s.expected)}<br>Actual: ${esc(s.actual)}</small></div>`).join('') || '—'}</td>
    </tr>`)
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AC Coverage Matrix</title>
<style>
:root{--bg:#f7f8fb;--card:#fff;--fg:#1d2433;--muted:#5d6779;--line:#e3e7ef;--pass:#1a7f4b;--pass-bg:#e3f6ec;--fail:#b42318;--fail-bg:#fde8e7;--skip:#8a5a00;--skip-bg:#fff4d6;--none:#475467;--none-bg:#eef1f5;--accent:#4f46e5}
@media (prefers-color-scheme:dark){:root{--bg:#0f1320;--card:#171c2b;--fg:#e6e9f2;--muted:#9aa3b5;--line:#2a3144;--pass:#5fd39a;--pass-bg:#123524;--fail:#ff8a80;--fail-bg:#3d1714;--skip:#f5c451;--skip-bg:#3a2d0b;--none:#b6bfcf;--none-bg:#232a3b;--accent:#8b85ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}h1{margin:0 0 4px;font-size:24px}h2{margin:32px 0 12px;font-size:18px}
.meta{color:var(--muted);margin-bottom:20px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column}
.tile .v{font-size:28px;font-weight:700}.tile .l{color:var(--muted)}.tile.pass .v{color:var(--pass)}.tile.fail .v{color:var(--fail)}.tile.skip .v{color:var(--skip)}.tile.none .v{color:var(--none)}.tile.acc .v{color:var(--accent)}
.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:760px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}tr:last-child td{border-bottom:0}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;white-space:nowrap}.num{white-space:nowrap}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:600;font-size:12px;white-space:nowrap}
.badge.pass{color:var(--pass);background:var(--pass-bg)}.badge.fail{color:var(--fail);background:var(--fail-bg)}.badge.skip{color:var(--skip);background:var(--skip-bg)}.badge.none{color:var(--none);background:var(--none-bg)}
.finding{margin-top:6px;color:var(--skip);font-size:12.5px}.step{margin:0 0 6px;padding-left:8px;border-left:3px solid var(--pass)}.step.ko{border-color:var(--fail)}
small{color:var(--muted)}ul{padding-left:20px}
</style></head><body><main>
<h1>Acceptance Criteria Coverage</h1>
<div class="meta">Run <b>${esc(r.runId)}</b> · ${esc(r.generatedAt)} · overall: <b>${esc(r.execution.status)}</b> · tests executed: ${r.execution.total} (passed ${r.execution.passed}, flaky ${r.execution.flaky}, failed ${r.execution.failed}, skipped ${r.execution.skipped})</div>
<div class="tiles">
${tile('Acceptance criteria', t.acceptanceCriteria, '')}${tile('Passed', t.Passed, 'pass')}${tile('Failed', t.Failed, 'fail')}${tile('Not executed', t['Not executed'], 'skip')}${tile('Not automated', t['Not automated'], 'none')}${tile('AC pass rate', `${t.coveragePercent}%`, 'acc')}
</div>
<h2>Coverage matrix</h2>
<div class="wrap"><table><thead><tr><th>AC</th><th>Status</th><th>Covered</th><th>Test cases</th><th>Steps pass / fail</th><th>Criterion</th></tr></thead><tbody>${rows}</tbody></table></div>
${r.warnings.length ? `<h2>Traceability warnings</h2><ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
<h2>Executed tests and step-level results</h2>
<div class="wrap"><table><thead><tr><th>Test case</th><th>Project</th><th>Status</th><th>Title</th><th>AC assertion steps</th></tr></thead><tbody>${tests}</tbody></table></div>
</main></body></html>`;
}
