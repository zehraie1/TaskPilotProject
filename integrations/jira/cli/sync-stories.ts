/**
 * Sync user stories, test cases, links and execution evidence to a Jira project (default TAS).
 *
 *   npm run jira:sync                → DRY RUN: prints the plan, writes nothing to Jira
 *   npm run jira:sync -- --approve   → creates/updates issues (idempotent via labels tpw-key-<id>)
 *
 * Sources: integrations/jira/tas-story-plan.ts · data/test-cases/catalogue.json · reports/coverage/ac-coverage.json (real run)
 * Evidence uploaded: per-story evidence report (.md) + selected UI step screenshots; per test case: screenshots (UI)
 * or a Jira-safe API evidence projection (other users' data removed); epic: coverage HTML, execution summary, JUnit XML.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../../../config/env.ts';
import type { AcRow, CoverageReport, TestRun } from '../../../reporting/ac-coverage-reporter.ts';
import { sanitize } from '../../../utils/sanitize.ts';
import { adf, type AdfNode } from '../adf.ts';
import { loadCoverage } from '../evidence-publisher.ts';
import { JiraClient, type JiraIssue } from '../jira-client.ts';
import { EPIC, STORIES, type PlanAC, type PlanStory } from '../tas-story-plan.ts';

type AcStatus = AcRow['status'];

interface CatalogueCase {
  id: string; storyKey: string; acIds: string[]; type: string; title: string; preconditions: string[];
  testData: Record<string, unknown>; steps: string[]; expectedResults: string[]; automationType: string;
  priority: 'P1' | 'P2' | 'P3'; status: string; automated: boolean; spec: string | null;
}

const ROOT = join(import.meta.dirname, '..', '..', '..');
const PROJECT = process.env.JIRA_PROJECT_KEY || 'TAS';
const approve = process.argv.includes('--approve');
const report: CoverageReport = loadCoverage();
const RUN = report.runId;
const catalogue = (JSON.parse(readFileSync(join(ROOT, 'data/test-cases/catalogue.json'), 'utf8')) as { testCases: CatalogueCase[] }).testCases;
const byTc = new Map(catalogue.map((c) => [c.id, c]));
const PRIORITY = { P1: 'High', P2: 'Medium', P3: 'Low' } as const;
const EXEC_NOTES: Record<string, string> = {
  'TC-DEMO-001': 'Opt-in headed demo (not part of the evidence run). Executed headed in Chromium on 2026-11-15 15:17 UTC: 3/3 passed, 3 TPW-DEMO tasks created and verified via API.',
};

// ── Integrity checks: every catalogue case belongs to a story and vice versa ──────────────
const planned = new Set(STORIES.flatMap((s) => s.acs.flatMap((a) => a.testCases)));
const missing = catalogue.filter((c) => !planned.has(c.id)).map((c) => c.id);
const unknown = [...planned].filter((id) => !byTc.has(id));
if (missing.length || unknown.length) {
  console.error(`Plan/catalogue mismatch. Not in any story: ${missing.join(', ') || '-'}; unknown ids: ${unknown.join(', ') || '-'}`);
  process.exit(1);
}

// ── Results (always from the real coverage report) ────────────────────────────────────────
function runsFor(tc: string, projects?: string[]): TestRun[] {
  return report.tests.filter((t) => t.testCase === tc && t.status !== 'not-run' && (!projects || projects.includes(t.project)));
}

function acResult(ac: PlanAC): { status: AcStatus; passed: number; failed: number; detail: string } {
  const runs = ac.testCases.flatMap((tc) => runsFor(tc, ac.projects));
  const automated = ac.testCases.some((tc) => byTc.get(tc)?.automated);
  if (ac.tpRefs.length) {
    const steps = runs.flatMap((r) => r.acSteps).filter((s) => (ac.tpRefs as string[]).includes(`${s.story}:${s.ac}`));
    const failed = steps.filter((s) => s.status === 'failed').length;
    const passed = steps.length - failed;
    const status: AcStatus = failed ? 'Failed' : passed ? 'Passed' : automated ? 'Not executed' : 'Not automated';
    return { status, passed, failed, detail: `${passed} assertion step(s) passed, ${failed} failed` };
  }
  const failed = runs.filter((r) => !['passed', 'skipped'].includes(r.status)).length;
  const passed = runs.filter((r) => r.status === 'passed').length;
  const status: AcStatus = failed ? 'Failed' : passed ? 'Passed' : automated ? 'Not executed' : 'Not automated';
  return { status, passed, failed, detail: `${passed} test run(s) passed, ${failed} failed` };
}

function tcExecution(tc: string): string {
  const runs = runsFor(tc);
  if (!runs.length) return EXEC_NOTES[tc] ?? (byTc.get(tc)?.automated ? 'Not executed in this run' : 'Not automated');
  return runs.map((r) => `${r.project}: ${r.status.toUpperCase()} (${(r.durationMs / 1000).toFixed(1)}s)`).join(' · ');
}

// ── Evidence selection ────────────────────────────────────────────────────────────────────
const SCREENSHOT_EXCLUDE = /dashboard metrics/; // shows other users' recent activity titles
// Tests whose FINAL page shows only TestPilot-created data (filtered list, own task details, empty/error states).
// Excluded on purpose: TC-UI-001 (dashboard), TC-UI-023 (unfiltered page 2), TC-UI-050 (ends on unfiltered list).
const END_SCREENSHOT_OK = new Set(['TC-UI-002', 'TC-UI-012', 'TC-UI-021', 'TC-UI-031', 'TC-UI-051', 'TC-HYB-004', 'TC-CG-001']);
function screenshotsFor(tc: string, max: number): { path: string; name: string }[] {
  return runsFor(tc, ['chromium'])
    .flatMap((r) => r.evidence)
    .filter((e) => e.path && e.contentType === 'image/png' &&
      ((e.name.startsWith('screenshot: ') && !SCREENSHOT_EXCLUDE.test(e.name)) || (e.name === 'screenshot' && END_SCREENSHOT_OK.has(tc))))
    .slice(0, max)
    .map((e, i) => ({ path: join(ROOT, e.path!), name: `${tc}-${RUN}-step${i + 1}-${(e.name.slice(12) || 'final-state').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` }))
    .filter((a) => existsSync(a.path));
}

/** Step-level execution evidence for one test case across every project it ran in. */
function tcEvidenceFile(tc: CatalogueCase): { path: string; name: string } | undefined {
  const runs = runsFor(tc.id);
  if (!runs.length) return undefined;
  const lines = [
    `# Test evidence — ${tc.id}: ${tc.title}`, '',
    `Run \`${RUN}\` · generated ${report.generatedAt} · spec \`${tc.spec}\``,
    'Results copied from reports/coverage/ac-coverage.json (Playwright execution) — not edited by hand.', '',
    '| Project | Status | Duration | Retry |', '|---|---|---|---|',
    ...runs.map((r) => `| ${r.project} | ${r.status} | ${(r.durationMs / 1000).toFixed(1)}s | ${r.retry} |`), '',
    '## Assertion steps', '',
    '| Project | AC | Step | Expected | Actual | Result |', '|---|---|---|---|---|---|',
    ...runs.flatMap((r) => r.acSteps.map((st) => `| ${r.project} | ${st.story}:${st.ac} | ${st.step} | ${st.expected} | ${st.actual.replace(/\|/g, '\\|')} | ${st.status} |`)),
    ...(runs.some((r) => r.acSteps.length) ? [] : ['| - | - | (test-level assertions only) | ' + tc.expectedResults.join('; ') + ' | ' + runs.map((r) => r.status).join(', ') + ' | - |']),
    '', '## Evidence produced by Playwright', '',
    ...runs.flatMap((r) => r.evidence.map((e) => `- ${r.project}: ${e.name} (${e.contentType})`)),
    '', 'Videos and traces are kept in the CI/local artifacts (not uploaded to Jira).',
  ];
  const dir = join(ROOT, 'reports', 'jira', 'evidence');
  mkdirSync(dir, { recursive: true });
  const name = `${tc.id}-${RUN}-test-evidence.md`;
  writeFileSync(join(dir, name), sanitize(lines.join('\n')));
  return { path: join(dir, name), name };
}

/** API evidence with only TestPilot-created records: other users' tasks on the shared DB are reduced to counts. */
function jiraSafeApiEvidence(tc: string): { path: string; name: string } | undefined {
  const run = runsFor(tc, ['api'])[0];
  const ev = run?.evidence.find((e) => e.name === 'api-exchanges.json' && e.path);
  if (!ev || !existsSync(join(ROOT, ev.path!))) return undefined;
  const ours = (t: { title?: string }) => typeof t?.title === 'string' && (t.title.startsWith('TPW-') || t.title === 'Z');
  const project = (body: unknown): unknown => {
    if (!body || typeof body !== 'object') return body;
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.items)) {
      const items = b.items as { title?: string }[];
      return { total: b.total, limit: b.limit, offset: b.offset, itemCount: items.length, testpilotItems: items.filter(ours), otherUsersItemsOmitted: items.filter((i) => !ours(i)).length };
    }
    if (Array.isArray(b.recent_activity)) {
      const items = b.recent_activity as { title?: string }[];
      return { ...b, recent_activity: items.filter(ours), recentActivityOtherUsersOmitted: items.filter((i) => !ours(i)).length };
    }
    if ('title' in b && !ours(b)) return { omitted: 'record not created by TestPilot PW' };
    return b;
  };
  const exchanges = JSON.parse(readFileSync(join(ROOT, ev.path!), 'utf8')) as Record<string, unknown>[];
  const safe = exchanges.map((x) => ({ ...x, url: String(x.url).replace(/^https?:\/\/[^/]+/, ''), responseBody: project(x.responseBody) }));
  const dir = join(ROOT, 'reports', 'jira', 'evidence');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${tc}-${RUN}-api-evidence.json`);
  writeFileSync(path, JSON.stringify(sanitize({ testCase: tc, runId: RUN, project: run.project, status: run.status, exchanges: safe }), null, 2));
  return { path, name: `${tc}-${RUN}-api-evidence.json` };
}

function storyEvidenceFile(story: PlanStory, keys: Map<string, string>): { path: string; name: string } {
  const lines = [
    `# Test evidence — ${keys.get(story.id) ?? story.id}: ${story.summary}`, '',
    `Run \`${RUN}\` · generated ${report.generatedAt} · overall run status: **${report.execution.status}**`,
    `Source: TestPilot PW (Playwright) — results copied from reports/coverage/ac-coverage.json, not edited by hand.`, '',
  ];
  for (const ac of story.acs) {
    const r = acResult(ac);
    lines.push(`## ${ac.id} — ${r.status}`, '', ac.text, '', `Result: ${r.detail}${ac.projects ? ` (projects: ${ac.projects.join(', ')})` : ''}`, '');
    lines.push('| Test case | Jira | Project | Status | Step | Expected | Actual |', '|---|---|---|---|---|---|---|');
    for (const tc of ac.testCases) {
      const runs = runsFor(tc, ac.projects);
      if (!runs.length) lines.push(`| ${tc} | ${keys.get(tc) ?? ''} | - | ${EXEC_NOTES[tc] ? 'see note' : byTc.get(tc)?.automated ? 'Not executed' : 'Not automated'} | - | - | ${EXEC_NOTES[tc] ?? '-'} |`);
      for (const run of runs) {
        const steps = ac.tpRefs.length ? run.acSteps.filter((s) => (ac.tpRefs as string[]).includes(`${s.story}:${s.ac}`)) : [];
        if (!steps.length) lines.push(`| ${tc} | ${keys.get(tc) ?? ''} | ${run.project} | ${run.status} | (whole test) | ${byTc.get(tc)?.expectedResults.join('; ')} | ${run.status} in ${(run.durationMs / 1000).toFixed(1)}s |`);
        for (const s of steps) lines.push(`| ${tc} | ${keys.get(tc) ?? ''} | ${run.project} | ${s.status} | ${s.step} | ${s.expected} | ${s.actual.replace(/\|/g, '\\|')} |`);
      }
    }
    lines.push('');
  }
  const dir = join(ROOT, 'reports', 'jira', 'evidence');
  mkdirSync(dir, { recursive: true });
  const name = `${story.id}-${RUN}-test-evidence.md`;
  writeFileSync(join(dir, name), sanitize(lines.join('\n')));
  return { path: join(dir, name), name };
}

// ── Description builders ──────────────────────────────────────────────────────────────────
const browse = (key: string) => `${env.jira.baseUrl}/browse/${key}`;
const keyLinks = (ids: string[], keys: Map<string, string>): AdfNode[] =>
  ids.flatMap((id, i) => {
    const key = keys.get(id);
    const node = key ? adf.link(`${key} (${id})`, browse(key)) : adf.text(id);
    return i ? [adf.text(', '), node] : [node];
  });

function storyDescription(story: PlanStory, keys: Map<string, string>): AdfNode {
  const rows = story.acs.map((ac) => {
    const r = acResult(ac);
    return [ac.id, r.status, ac.testCases.map((tc) => keys.get(tc) ?? tc).join(', '), r.detail];
  });
  return adf.doc(
    adf.heading('User story'),
    adf.paragraph(adf.text('As a '), adf.text(story.asA, true), adf.text(', I want '), adf.text(story.iWant, true), adf.text(', so that '), adf.text(story.soThat, true), adf.text('.')),
    adf.paragraph(adf.text(story.context)),
    adf.heading('Acceptance criteria'),
    adf.ordered(story.acs.map((ac) => `${ac.id}: ${ac.text}`)),
    ...(story.notes?.length ? [adf.panel('warning', ...story.notes.map((n) => adf.paragraph(adf.text(n))))] : []),
    adf.heading('Test coverage (latest execution)'),
    adf.table(['AC', 'Status', 'Test cases', 'Evidence'], rows),
    adf.heading('Linked test cases', 4),
    adf.richBullets([...new Set(story.acs.flatMap((a) => a.testCases))].map((tc) => [
      ...keyLinks([tc], keys), adf.text(` — ${byTc.get(tc)?.title ?? ''} — ${tcExecution(tc)}`),
    ])),
    adf.heading('Definition of done', 4),
    adf.bullets([
      'Every acceptance criterion is mapped to at least one approved test case (or explicitly marked not automated with a reason).',
      'Automated test cases pass in the latest run; evidence (test evidence report, screenshots, API evidence) is attached.',
      'No test data left behind in the shared TaskPilot database.',
    ]),
    adf.paragraph(adf.text(`Source: TestPilot PW story plan ${story.id} · run ${RUN} · `), adf.link('Epic', browse(keys.get('EPIC') ?? ''))),
  );
}

function tcDescription(tc: CatalogueCase, keys: Map<string, string>): AdfNode {
  const stories = STORIES.filter((s) => s.acs.some((a) => a.testCases.includes(tc.id)));
  const runs = runsFor(tc.id);
  return adf.doc(
    adf.table(['Field', 'Value'], [
      ['Test Case ID', tc.id],
      ['Jira stories', stories.map((s) => `${keys.get(s.id) ?? s.id} ${s.summary} (${s.acs.filter((a) => a.testCases.includes(tc.id)).map((a) => a.id).join(', ')})`).join('; ')],
      ['Framework AC refs', `${tc.storyKey}: ${tc.acIds.join(', ') || '-'}`],
      ['Scenario', tc.title],
      ['Type', tc.type],
      ['Automation type', tc.automationType],
      ['Priority', `${tc.priority} (${PRIORITY[tc.priority]})`],
      ['Spec', tc.spec ?? 'not automated'],
      ['Review status', tc.status],
    ]),
    adf.heading('Preconditions', 4), adf.bullets(tc.preconditions.length ? tc.preconditions : ['None']),
    adf.heading('Test data', 4), adf.code(JSON.stringify(tc.testData, null, 2)),
    adf.heading('Steps', 4), adf.ordered(tc.steps),
    adf.heading('Expected results', 4), adf.bullets(tc.expectedResults),
    adf.heading('Latest execution', 4),
    adf.paragraph(adf.text(tcExecution(tc.id), true)),
    ...(runs.some((r) => r.acSteps.length)
      ? [adf.table(['Project', 'AC', 'Step', 'Expected', 'Actual', 'Result'],
          runs.flatMap((r) => r.acSteps.map((s) => [r.project, `${s.story}:${s.ac}`, s.step, s.expected, s.actual, s.status]))) ]
      : []),
    adf.paragraph(adf.text(`Run ${RUN} · evidence attached to this issue · `), adf.link('Epic', browse(keys.get('EPIC') ?? ''))),
  );
}

// ── Sync ──────────────────────────────────────────────────────────────────────────────────
const statusIcon = (s: AcStatus) => ({ Passed: '✅', Failed: '❌', 'Not executed': '⏸', 'Not automated': '⬜' })[s];

console.log(`Jira sync → project ${PROJECT} @ ${env.jira.baseUrl} · run ${RUN} · ${approve ? 'APPROVED (writing)' : 'DRY RUN'}`);
for (const s of STORIES) {
  console.log(`  ${s.id} ${s.summary}`);
  for (const ac of s.acs) console.log(`     ${statusIcon(acResult(ac).status)} ${ac.id} ${acResult(ac).status.padEnd(13)} ${ac.testCases.join(', ')}`);
}
console.log(`  + ${catalogue.length} test case issues, epic, links and evidence`);
if (!approve) {
  console.log('\nDry run only. Re-run with --approve to write to Jira.');
  process.exit(0);
}

const jira = new JiraClient();
const record: { created: string[]; updated: string[]; links: number; attachments: string[]; skippedAttachments: string[]; comments: string[]; errors: string[] } =
  { created: [], updated: [], links: 0, attachments: [], skippedAttachments: [], comments: [], errors: [] };

const existing = new Map<string, JiraIssue>();
for (const issue of await jira.search(`project = ${PROJECT} AND labels = tpw`, ['summary', 'labels'])) {
  const label = (issue.fields.labels ?? []).find((l) => l.startsWith('tpw-key-'));
  if (label) existing.set(label.slice(8), issue);
}
const keys = new Map<string, string>([...existing].map(([id, i]) => [id, i.key]));

async function upsert(id: string, fields: Record<string, unknown>): Promise<string> {
  const found = existing.get(id);
  if (found) {
    await jira.updateIssue(found.key, fields);
    record.updated.push(found.key);
    return found.key;
  }
  const created = await jira.createIssue({ project: { key: PROJECT }, ...fields });
  record.created.push(created.key);
  keys.set(id, created.key);
  return created.key;
}

const placeholder = adf.doc(adf.paragraph(adf.text('Being generated by TestPilot PW…')));

// 1. Epic, stories, test cases (create first so descriptions can cross-link keys)
const epicKey = await upsert('EPIC', { issuetype: { name: 'Epic' }, summary: EPIC.summary, labels: ['tpw', 'tpw-key-EPIC'], priority: { name: 'High' }, description: existing.has('EPIC') ? undefined : placeholder });
keys.set('EPIC', epicKey);
for (const s of STORIES) {
  await upsert(s.id, { issuetype: { name: 'Story' }, summary: s.summary, parent: { key: epicKey }, priority: { name: s.priority }, labels: ['tpw', 'user-story', `tpw-key-${s.id}`], ...(existing.has(s.id) ? {} : { description: placeholder }) });
}
for (const tc of catalogue) {
  await upsert(tc.id, {
    issuetype: { name: 'Task' }, summary: `${tc.id} · ${tc.title}`, parent: { key: epicKey }, priority: { name: PRIORITY[tc.priority] },
    labels: ['tpw', 'test-case', `tpw-key-${tc.id}`, `automation-${tc.automationType.toLowerCase()}`, `case-${tc.type}`],
    ...(existing.has(tc.id) ? {} : { description: placeholder }),
  });
}

// 2. Final descriptions with cross-links
await jira.updateIssue(epicKey, {
  description: adf.doc(
    adf.paragraph(adf.text(EPIC.description)),
    adf.heading('Latest execution'),
    adf.paragraph(adf.text(`Run ${RUN} · ${report.execution.total} tests · passed ${report.execution.passed} · flaky ${report.execution.flaky} · failed ${report.execution.failed} · skipped ${report.execution.skipped} · status ${report.execution.status}`)),
    adf.heading('User stories'),
    adf.table(['Story', 'Summary', 'ACs passed', 'Test cases'], STORIES.map((s) => [
      keys.get(s.id)!, s.summary, `${s.acs.filter((a) => acResult(a).status === 'Passed').length}/${s.acs.length}`,
      String(new Set(s.acs.flatMap((a) => a.testCases)).size),
    ])),
    adf.paragraph(adf.text('Attachments: AC coverage HTML report, execution summary and JUnit XML from the same run.')),
  ),
});
for (const s of STORIES) await jira.updateIssue(keys.get(s.id)!, { description: storyDescription(s, keys) });
for (const tc of catalogue) await jira.updateIssue(keys.get(tc.id)!, { description: tcDescription(tc, keys) });

// 3. Links: test case "relates to" story
for (const s of STORIES) {
  const storyKey = keys.get(s.id)!;
  const details = await jira.getIssueDetails(storyKey);
  const linked = new Set(((details.fields.issuelinks ?? []) as { inwardIssue?: { key: string }; outwardIssue?: { key: string } }[])
    .map((l) => l.inwardIssue?.key ?? l.outwardIssue?.key));
  for (const tc of new Set(s.acs.flatMap((a) => a.testCases))) {
    const tcKey = keys.get(tc)!;
    if (linked.has(tcKey)) continue;
    await jira.linkIssues('Relates', tcKey, storyKey);
    record.links++;
  }
}

// 4. Attachments (skip same file name → no duplicates on re-run)
async function attach(key: string, files: { path: string; name: string }[]): Promise<void> {
  if (!files.length) return;
  const have = new Set(((await jira.getIssueDetails(key)).fields.attachment ?? []).map((a) => a.filename));
  for (const f of files) {
    if (have.has(f.name)) { record.skippedAttachments.push(`${key}/${f.name}`); continue; }
    try {
      await jira.addAttachment(key, f.path, f.name);
      record.attachments.push(`${key}/${f.name}`);
    } catch (e) { record.errors.push(`${key}/${f.name}: ${(e as Error).message}`); }
  }
}
const reportFiles = [
  ['reports/coverage/ac-coverage.html', `testpilot-${RUN}-ac-coverage.html`],
  ['reports/coverage/execution-summary.md', `testpilot-${RUN}-execution-summary.md`],
  ['reports/junit/results.xml', `testpilot-${RUN}-junit.xml`],
].map(([p, name]) => ({ path: join(ROOT, p), name })).filter((f) => existsSync(f.path));
await attach(epicKey, reportFiles);
for (const tc of catalogue) {
  const files = [tcEvidenceFile(tc), ...(tc.automationType === 'API' ? [jiraSafeApiEvidence(tc.id)] : screenshotsFor(tc.id, 3))]
    .filter((f): f is { path: string; name: string } => !!f);
  await attach(keys.get(tc.id)!, files);
}
for (const s of STORIES) {
  const shots = [...new Set(s.acs.flatMap((a) => a.testCases))].flatMap((tc) => screenshotsFor(tc, 1)).slice(0, 4);
  await attach(keys.get(s.id)!, [storyEvidenceFile(s, keys), ...shots]);
}

// 5. Evidence comment per story (one per run — marker prevents duplicates)
for (const s of STORIES) {
  const key = keys.get(s.id)!;
  const marker = `testpilot-sync:${s.id}:${RUN}`;
  const comments = await jira.getComments(key);
  if (comments.some((c) => JSON.stringify(c.body).includes(marker))) continue;
  const results = s.acs.map((a) => ({ a, r: acResult(a) }));
  const overall = results.some((x) => x.r.status === 'Failed') ? 'FAILED' : results.every((x) => x.r.status === 'Passed') ? 'PASSED' : 'PARTIAL';
  await jira.addComment(key, adf.doc(
    adf.heading(`Test execution evidence — ${overall}`, 3),
    adf.paragraph(adf.text(`TestPilot PW run ${RUN} (${report.generatedAt}). ACs passed: ${results.filter((x) => x.r.status === 'Passed').length}/${results.length}.`)),
    adf.table(['AC', 'Status', 'Result'], results.map(({ a, r }) => [a.id, r.status, r.detail])),
    adf.paragraph(adf.text(`Attached: ${s.id}-${RUN}-test-evidence.md (step-level expected vs actual) and UI step screenshots where applicable. Full reports are attached to the epic.`)),
    adf.paragraph(adf.text(marker)),
  ));
  record.comments.push(key);
}

// 6. Persist the mapping and the sync record
const map = Object.fromEntries([...keys].sort());
writeFileSync(join(ROOT, 'data', 'jira', 'tas-issue-map.json'), JSON.stringify({ project: PROJECT, site: env.jira.baseUrl, syncedRun: RUN, issues: map }, null, 2) + '\n');
mkdirSync(join(ROOT, 'reports', 'jira'), { recursive: true });
writeFileSync(join(ROOT, 'reports', 'jira', `tas-sync-${RUN}.json`), JSON.stringify({ at: new Date().toISOString(), runId: RUN, ...record }, null, 2));

console.log(`\nCreated ${record.created.length}, updated ${record.updated.length}, links ${record.links}, attachments ${record.attachments.length} (skipped ${record.skippedAttachments.length}), comments ${record.comments.length}, errors ${record.errors.length}`);
for (const e of record.errors) console.error(`  ERROR ${e}`);
console.log(`Epic: ${browse(epicKey)}`);
process.exit(record.errors.length ? 1 : 0);
