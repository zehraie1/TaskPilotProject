/**
 * Acceptance-criteria traceability.
 *
 * 1. `trace()` declares STATIC metadata on a test: test case id, Jira story and the ACs it is designed to cover.
 * 2. `verifyAC()` wraps a `test.step()` that MUST contain assertions. Its outcome (expected, actual, pass/fail)
 *    is recorded as a runtime annotation that the AC coverage reporter turns into the coverage matrix.
 *
 * A test only counts toward AC coverage when a `verifyAC` step for that AC actually executed — a Jira tag alone is not coverage.
 */
import { test, type TestDetails } from '@playwright/test';

/** Fully-qualified acceptance criterion reference, e.g. "TP-101:AC1". */
export type AcRef = `${string}-${number}:AC${number}`;

export interface TraceMeta {
  /** Test case id from the approved test-case catalogue, e.g. "TC-API-001". */
  testCase: string;
  /** ACs this test is designed to verify. */
  covers: AcRef[];
  /** Extra tags such as "@smoke", "@negative", "@boundary". */
  tags?: string[];
}

export interface AcStepRecord {
  testCase: string;
  story: string;
  ac: string;
  step: string;
  expected: string;
  actual: string;
  status: 'passed' | 'failed';
  evidence: string[];
}

export const AC_STEP_ANNOTATION = 'ac-step';

export function storyOf(ref: AcRef): string {
  return ref.split(':')[0];
}

/** Build Playwright test details (tags + annotations) from traceability metadata. */
export function trace(meta: TraceMeta): TestDetails {
  const stories = [...new Set(meta.covers.map(storyOf))];
  return {
    tag: [...stories.map((s) => `@${s}`), `@${meta.testCase}`, ...(meta.tags ?? [])],
    annotation: [
      { type: 'testcase', description: meta.testCase },
      ...stories.map((s) => ({ type: 'story', description: s })),
      ...meta.covers.map((ac) => ({ type: 'ac', description: ac })),
    ],
  };
}

/**
 * Execute a traceable step. `body` performs actions + assertions and may return a short
 * description of the ACTUAL observed result (e.g. "HTTP 201, status=pending").
 */
export async function verifyAC<T extends string | void>(
  ac: AcRef,
  step: string,
  expected: string,
  body: () => Promise<T>,
): Promise<T> {
  const info = test.info();
  const testCase = info.annotations.find((a) => a.type === 'testcase')?.description ?? 'UNMAPPED';
  const [story, acId] = ac.split(':');
  const record = (status: AcStepRecord['status'], actual: string): void => {
    const evidence = info.attachments.map((a) => a.name);
    const rec: AcStepRecord = { testCase, story, ac: acId, step, expected, actual, status, evidence };
    info.annotations.push({ type: AC_STEP_ANNOTATION, description: JSON.stringify(rec) });
  };

  return test.step(`[${ac}] ${step}`, async () => {
    try {
      const actual = await body();
      record('passed', typeof actual === 'string' && actual ? actual : expected);
      return actual;
    } catch (error) {
      // Strip ANSI colour codes so reports and Jira comments stay readable.
      const message = (error as Error).message.replace(/\u001b\[[0-9;]*m/g, '');
      record('failed', message.split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 300));
      throw error;
    }
  });
}
