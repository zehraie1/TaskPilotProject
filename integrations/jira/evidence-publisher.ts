/**
 * Jira Evidence Publisher.
 *
 * Builds an execution summary for ONE story from REAL results (reports/coverage/ac-coverage.json),
 * then — only when explicitly approved — posts it to Jira:
 *   1. comment with summary, test case ids and AC coverage table
 *   2. selected screenshots (max 3, PNG only) + the self-contained AC coverage HTML report
 *   3. remote link to the GitHub commit / Actions run
 * Duplicate protection: a run marker in the comment and run-specific attachment names are checked first.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ciRunUrl, env } from '../../config/env.ts';
import type { CoverageReport } from '../../reporting/ac-coverage-reporter.ts';
import { sanitizeString } from '../../utils/sanitize.ts';
import { adf, adfToText, type AdfNode } from './adf.ts';
import { JiraClient } from './jira-client.ts';

const ROOT = join(import.meta.dirname, '..', '..');
export const COVERAGE_FILE = join(ROOT, 'reports', 'coverage', 'ac-coverage.json');
export const PUBLISH_DIR = join(ROOT, 'reports', 'jira');

export interface PublishPlan {
  storyKey: string;
  runId: string;
  marker: string;
  comment: AdfNode;
  commentPreview: string;
  attachments: { path: string; name: string }[];
  remoteLink?: { globalId: string; url: string; title: string };
  summary: { passed: number; failed: number; notExecuted: number; notAutomated: number; tests: number };
}

export interface PublishResult {
  storyKey: string;
  runId: string;
  mode: 'dry-run' | 'published';
  at: string;
  comment: 'posted' | 'skipped-duplicate' | 'not-sent';
  attachments: { name: string; outcome: 'uploaded' | 'skipped-duplicate' | 'not-sent' }[];
  remoteLink: 'linked' | 'not-sent' | 'not-available';
  error?: string;
}

export function loadCoverage(file = COVERAGE_FILE): CoverageReport {
  if (!existsSync(file)) throw new Error(`No execution results at ${file}. Run the tests first — results are never invented.`);
  return JSON.parse(readFileSync(file, 'utf8')) as CoverageReport;
}

export function buildPlan(report: CoverageReport, storyKey: string): PublishPlan {
  const rows = report.rows.filter((r) => r.story === storyKey);
  if (!rows.length) throw new Error(`Story ${storyKey} is not in the requirement registry.`);
  const tests = report.tests.filter(
    (t) => t.status !== 'not-run' && (t.mappedAcs.some((a) => a.startsWith(`${storyKey}:`)) || t.acSteps.some((s) => s.story === storyKey)),
  );
  const runId = env.ci.runId || report.runId;
  const marker = `testpilot-run:${createHash('sha256').update(`${storyKey}|${runId}|${env.ci.sha}`).digest('hex').slice(0, 16)}`;
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const summary = {
    passed: count('Passed'), failed: count('Failed'), notExecuted: count('Not executed'), notAutomated: count('Not automated'), tests: tests.length,
  };
  const failedTests = tests.filter((t) => !['passed', 'skipped'].includes(t.status));
  const ciUrl = ciRunUrl();
  const commitUrl = env.ci.repository && env.ci.sha ? `${env.ci.serverUrl}/${env.ci.repository}/commit/${env.ci.sha}` : undefined;

  const comment = adf.doc(
    adf.heading(`TestPilot PW execution — ${storyKey}`),
    adf.paragraph(
      adf.text('Result: ', true), adf.text(summary.failed ? 'FAILED' : summary.passed ? 'PASSED' : 'NOT EXECUTED'),
      adf.text(`  ·  ACs passed ${summary.passed}/${rows.length}  ·  tests executed ${tests.length}  ·  run ${runId}`),
    ),
    adf.table(
      ['AC', 'Status', 'Test cases', 'Assertion steps (pass/fail)'],
      rows.map((r) => [r.ref, r.status, r.testCases.join(', '), `${r.passedSteps}/${r.failedSteps}`]),
    ),
    adf.heading('Executed test cases', 4),
    adf.bullets(tests.map((t) => `${t.testCase} [${t.project}] ${t.status.toUpperCase()} — ${sanitizeString(t.title)}`)),
    ...(failedTests.length
      ? [adf.heading('Failures', 4), adf.bullets(failedTests.map((t) => `${t.testCase}: ${sanitizeString(t.error ?? 'see report')}`))]
      : []),
    adf.paragraph(
      ...(ciUrl ? [adf.text('CI run: '), adf.link(ciUrl, ciUrl), adf.text('  ')] : [adf.text('Executed locally (no CI run link).  ')]),
      ...(commitUrl ? [adf.text('Commit: '), adf.link(env.ci.sha.slice(0, 7), commitUrl)] : []),
    ),
    adf.paragraph(adf.text(marker)), // de-duplication marker — do not remove
  );

  // Evidence: the self-contained coverage report + up to 3 screenshots (failures first). Never videos/traces (size, PII risk).
  const attachments: PublishPlan['attachments'] = [];
  const html = join(ROOT, 'reports', 'coverage', 'ac-coverage.html');
  if (existsSync(html)) attachments.push({ path: html, name: `testpilot-${storyKey}-${runId}-ac-coverage.html` });
  const shots = [...failedTests, ...tests.filter((t) => t.status === 'passed')]
    .flatMap((t) => t.evidence.filter((e) => e.contentType === 'image/png' && e.path).map((e) => ({ t, e })))
    .slice(0, 3);
  shots.forEach(({ t, e }, i) => {
    const p = join(ROOT, e.path!);
    if (existsSync(p)) attachments.push({ path: p, name: `testpilot-${storyKey}-${runId}-${t.testCase}-${i + 1}.png` });
  });

  return {
    storyKey, runId, marker, comment, commentPreview: adfToText(comment), attachments, summary,
    remoteLink: ciUrl ? { globalId: `testpilot-pw-${runId}`, url: ciUrl, title: `TestPilot PW run ${runId}` } : undefined,
  };
}

export async function publish(plan: PublishPlan, approve: boolean): Promise<PublishResult> {
  const result: PublishResult = {
    storyKey: plan.storyKey, runId: plan.runId, at: new Date().toISOString(), mode: 'dry-run', comment: 'not-sent',
    attachments: plan.attachments.map((a) => ({ name: a.name, outcome: 'not-sent' as const })),
    remoteLink: plan.remoteLink ? 'not-sent' : 'not-available',
  };

  if (approve && env.jira.publishEnabled) {
    result.mode = 'published';
    try {
      const jira = new JiraClient();
      const issue = await jira.getIssue(plan.storyKey); // 1. locate source story (throws if missing)

      const comments = await jira.getComments(issue.key);
      if (comments.some((c) => JSON.stringify(c.body).includes(plan.marker))) {
        result.comment = 'skipped-duplicate';
      } else {
        await jira.addComment(issue.key, plan.comment);
        result.comment = 'posted';
      }

      const existing = new Set((issue.fields.attachment ?? []).map((a) => a.filename));
      result.attachments = [];
      for (const a of plan.attachments) {
        if (existing.has(a.name)) {
          result.attachments.push({ name: a.name, outcome: 'skipped-duplicate' });
          continue;
        }
        await jira.addAttachment(issue.key, a.path, a.name);
        result.attachments.push({ name: a.name, outcome: 'uploaded' });
      }

      if (plan.remoteLink) {
        await jira.addRemoteLink(issue.key, plan.remoteLink.globalId, plan.remoteLink.url, plan.remoteLink.title);
        result.remoteLink = 'linked';
      }
    } catch (error) {
      result.error = sanitizeString((error as Error).message);
    }
  }

  mkdirSync(PUBLISH_DIR, { recursive: true });
  writeFileSync(join(PUBLISH_DIR, `${plan.storyKey}-${plan.runId}.${result.mode}.json`), JSON.stringify({ result, plan: { ...plan, comment: undefined, attachments: plan.attachments.map((a) => ({ name: a.name, source: basename(a.path) })) } }, null, 2));
  return result;
}
