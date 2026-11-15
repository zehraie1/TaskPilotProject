/**
 * Custom Playwright reporter: Acceptance-Criteria coverage matrix + execution & failure summaries.
 *
 * Coverage is computed from EXECUTED `verifyAC()` steps, not from tags:
 *   Passed        – at least one AC assertion step ran and all of them passed
 *   Failed        – at least one AC assertion step failed
 *   Not executed  – mapped to an automated test (catalogue or test annotation) but no AC step ran in this execution
 *   Not automated – no automated test is mapped to the AC
 *
 * Outputs (reports/coverage/): ac-coverage.json | .md | .html, execution-summary.md, failure-summary.md
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { loadRequirementRegistry } from '../integrations/jira/story-reader.ts';
import { AC_STEP_ANNOTATION, type AcStepRecord } from '../utils/traceability.ts';
import { renderCoverageHtml } from './coverage-html.ts';

export type AcStatus = 'Passed' | 'Failed' | 'Not executed' | 'Not automated';

interface CatalogueEntry {
  id: string;
  storyKey: string;
  acIds: string[];
  automationType: string;
  status: string;
  automated?: boolean;
}

export interface TestRun {
  testCase: string;
  title: string;
  project: string;
  file: string;
  status: TestResult['status'] | 'not-run';
  durationMs: number;
  retry: number;
  error?: string;
  mappedAcs: string[];
  acSteps: AcStepRecord[];
  evidence: { name: string; contentType: string; path?: string }[];
}

export interface AcRow {
  ref: string;
  story: string;
  ac: string;
  text: string;
  status: AcStatus;
  covered: boolean;
  testCases: string[];
  executedSteps: number;
  passedSteps: number;
  failedSteps: number;
  findings: string[];
}

export interface CoverageReport {
  generatedAt: string;
  runId: string;
  totals: Record<AcStatus, number> & { acceptanceCriteria: number; coveragePercent: number };
  execution: { total: number; passed: number; failed: number; skipped: number; flaky: number; durationMs: number; status: string };
  rows: AcRow[];
  tests: TestRun[];
  warnings: string[];
}

class AcCoverageReporter implements Reporter {
  private readonly outputDir: string;
  private rootDir = process.cwd();
  private readonly runs = new Map<string, TestRun>();
  private startedAt = Date.now();

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? 'reports/coverage';
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.rootDir = config.rootDir.replace(/\/tests$/, '');
    this.startedAt = Date.now();
    for (const test of suite.allTests()) {
      this.runs.set(test.id, {
        testCase: test.annotations.find((a) => a.type === 'testcase')?.description ?? 'UNMAPPED',
        title: test.title,
        project: test.parent.project()?.name ?? '',
        file: relative(this.rootDir, test.location.file),
        status: 'not-run',
        durationMs: 0,
        retry: 0,
        mappedAcs: test.annotations.filter((a) => a.type === 'ac').map((a) => a.description ?? ''),
        acSteps: [],
        evidence: [],
      });
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const run = this.runs.get(test.id);
    if (!run) return;
    const annotations = (result as TestResult & { annotations?: TestCase['annotations'] }).annotations ?? test.annotations;
    run.status = result.status;
    run.durationMs = result.duration;
    run.retry = result.retry;
    run.error = result.error?.message?.replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0]?.slice(0, 300);
    // Keep only the final attempt's AC steps (retries replace earlier evidence).
    run.acSteps = annotations
      .filter((a) => a.type === AC_STEP_ANNOTATION && a.description)
      .map((a) => JSON.parse(a.description as string) as AcStepRecord);
    run.evidence = result.attachments.map((a) => ({
      name: a.name,
      contentType: a.contentType,
      path: a.path ? relative(this.rootDir, a.path) : undefined,
    }));
  }

  onEnd(result: FullResult): void {
    const report = this.build(result);
    const dir = join(this.rootDir, this.outputDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'ac-coverage.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(dir, 'ac-coverage.md'), this.markdown(report));
    writeFileSync(join(dir, 'ac-coverage.html'), renderCoverageHtml(report));
    writeFileSync(join(dir, 'execution-summary.md'), this.executionSummary(report));
    writeFileSync(join(dir, 'failure-summary.md'), this.failureSummary(report));
    const t = report.totals;
    console.log(
      `\n[ac-coverage] ${t.acceptanceCriteria} ACs → Passed ${t.Passed} | Failed ${t.Failed} | Not executed ${t['Not executed']} | Not automated ${t['Not automated']}  (${t.coveragePercent}% passed)` +
        `\n[ac-coverage] reports written to ${this.outputDir}/`,
    );
  }

  private loadCatalogue(): CatalogueEntry[] {
    const file = join(this.rootDir, 'data', 'test-cases', 'catalogue.json');
    if (!existsSync(file)) return [];
    return (JSON.parse(readFileSync(file, 'utf8')) as { testCases: CatalogueEntry[] }).testCases;
  }

  private build(result: FullResult): CoverageReport {
    const tests = [...this.runs.values()];
    const executed = tests.filter((t) => t.status !== 'not-run');
    const catalogue = this.loadCatalogue();
    const warnings: string[] = [];

    // Tag-only coverage detection: test claims an AC but never executed a verifyAC step for it.
    for (const t of executed.filter((x) => x.status === 'passed')) {
      for (const ac of t.mappedAcs) {
        if (!t.acSteps.some((s) => `${s.story}:${s.ac}` === ac)) {
          warnings.push(`${t.testCase} (${t.project}) is tagged with ${ac} but executed no verifyAC step for it — not counted as coverage.`);
        }
      }
    }
    const catalogueIds = new Set(catalogue.map((c) => c.id));
    for (const id of new Set(tests.map((t) => t.testCase))) {
      if (id !== 'UNMAPPED' && catalogue.length && !catalogueIds.has(id)) warnings.push(`${id} is not in the approved test case catalogue.`);
    }

    const rows: AcRow[] = [];
    for (const story of loadRequirementRegistry()) {
      for (const ac of story.acceptanceCriteria) {
        const steps = executed.flatMap((t) => t.acSteps).filter((s) => s.story === story.key && s.ac === ac.id);
        const fromTests = tests.filter((t) => t.mappedAcs.includes(ac.ref)).map((t) => t.testCase);
        const fromCatalogue = catalogue.filter((c) => c.storyKey === story.key && c.acIds.includes(ac.id) && c.automated).map((c) => c.id);
        const testCases = [...new Set([...fromCatalogue, ...fromTests])].sort();
        const failedSteps = steps.filter((s) => s.status === 'failed').length;
        const passedSteps = steps.length - failedSteps;
        const status: AcStatus = failedSteps
          ? 'Failed'
          : passedSteps
            ? 'Passed'
            : testCases.length
              ? 'Not executed'
              : 'Not automated';
        rows.push({
          ref: ac.ref, story: story.key, ac: ac.id, text: ac.text, status,
          covered: steps.length > 0, testCases,
          executedSteps: steps.length, passedSteps, failedSteps,
          findings: story.findings.filter((f) => f.scope === ac.id).map((f) => `${f.severity}: ${f.message}`),
        });
      }
    }

    const count = (s: AcStatus) => rows.filter((r) => r.status === s).length;
    const totals = {
      acceptanceCriteria: rows.length,
      Passed: count('Passed'), Failed: count('Failed'), 'Not executed': count('Not executed'), 'Not automated': count('Not automated'),
      coveragePercent: rows.length ? Math.round((count('Passed') / rows.length) * 100) : 0,
    };
    return {
      generatedAt: new Date().toISOString(),
      runId: process.env.TPW_RUN_ID ?? '',
      totals,
      execution: {
        total: executed.length,
        passed: executed.filter((t) => t.status === 'passed' && t.retry === 0).length,
        flaky: executed.filter((t) => t.status === 'passed' && t.retry > 0).length,
        failed: executed.filter((t) => t.status === 'failed' || t.status === 'timedOut' || t.status === 'interrupted').length,
        skipped: executed.filter((t) => t.status === 'skipped').length,
        durationMs: Date.now() - this.startedAt,
        status: result.status,
      },
      rows,
      tests,
      warnings,
    };
  }

  private markdown(r: CoverageReport): string {
    const icon: Record<AcStatus, string> = { Passed: '✅', Failed: '❌', 'Not executed': '⏸️', 'Not automated': '⬜' };
    return [
      '# Acceptance Criteria Coverage Matrix',
      '',
      `Run \`${r.runId}\` · generated ${r.generatedAt} · overall result: **${r.execution.status}**`,
      '',
      `| Total ACs | ✅ Passed | ❌ Failed | ⏸️ Not executed | ⬜ Not automated | AC pass rate |`,
      '|---|---|---|---|---|---|',
      `| ${r.totals.acceptanceCriteria} | ${r.totals.Passed} | ${r.totals.Failed} | ${r.totals['Not executed']} | ${r.totals['Not automated']} | ${r.totals.coveragePercent}% |`,
      '',
      '| AC | Status | Covered | Test cases | Steps (pass/fail) | Acceptance criterion | Requirement findings |',
      '|---|---|---|---|---|---|---|',
      ...r.rows.map((x) =>
        `| ${x.ref} | ${icon[x.status]} ${x.status} | ${x.covered ? 'Yes' : 'No'} | ${x.testCases.join(', ') || '-'} | ${x.passedSteps}/${x.failedSteps} | ${x.text.replace(/\|/g, '\\|')} | ${x.findings.join('<br>') || '-'} |`),
      '',
      ...(r.warnings.length ? ['## Traceability warnings', '', ...r.warnings.map((w) => `- ${w}`), ''] : []),
    ].join('\n');
  }

  private executionSummary(r: CoverageReport): string {
    const e = r.execution;
    const byProject = new Map<string, { passed: number; failed: number; skipped: number }>();
    for (const t of r.tests.filter((x) => x.status !== 'not-run')) {
      const p = byProject.get(t.project) ?? { passed: 0, failed: 0, skipped: 0 };
      if (t.status === 'passed') p.passed++;
      else if (t.status === 'skipped') p.skipped++;
      else p.failed++;
      byProject.set(t.project, p);
    }
    return [
      '# Execution Summary',
      '',
      `- Run id: \`${r.runId}\``,
      `- Overall status: **${e.status}**`,
      `- Tests executed: ${e.total} (passed ${e.passed}, flaky ${e.flaky}, failed ${e.failed}, skipped ${e.skipped})`,
      `- Duration: ${(e.durationMs / 1000).toFixed(1)} s`,
      `- AC pass rate: ${r.totals.coveragePercent}% (${r.totals.Passed}/${r.totals.acceptanceCriteria})`,
      '',
      '| Project | Passed | Failed | Skipped |',
      '|---|---|---|---|',
      ...[...byProject].map(([p, c]) => `| ${p} | ${c.passed} | ${c.failed} | ${c.skipped} |`),
      '',
      '| Test case | Project | Status | Duration | AC steps | Title |',
      '|---|---|---|---|---|---|',
      ...r.tests
        .filter((t) => t.status !== 'not-run')
        .sort((a, b) => a.testCase.localeCompare(b.testCase))
        .map((t) => `| ${t.testCase} | ${t.project} | ${t.status} | ${(t.durationMs / 1000).toFixed(1)}s | ${t.acSteps.length} | ${t.title} |`),
      '',
    ].join('\n');
  }

  private failureSummary(r: CoverageReport): string {
    const failed = r.tests.filter((t) => ['failed', 'timedOut', 'interrupted'].includes(t.status));
    if (!failed.length) return '# Failure Summary\n\nNo failed tests in this execution.\n';
    return [
      '# Failure Summary',
      '',
      ...failed.flatMap((t) => [
        `## ${t.testCase} — ${t.title} (${t.project})`,
        '',
        `- File: \`${t.file}\``,
        `- Error: ${t.error ?? 'n/a'}`,
        ...t.acSteps.filter((s) => s.status === 'failed').map((s) => `- Failed step [${s.story}:${s.ac}] ${s.step} — expected: ${s.expected}; actual: ${s.actual}`),
        ...t.evidence.filter((ev) => ev.path).map((ev) => `- Evidence (${ev.name}): \`${ev.path}\``),
        '',
      ]),
    ].join('\n');
  }
}

export default AcCoverageReporter;
