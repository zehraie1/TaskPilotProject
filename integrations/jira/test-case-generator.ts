/**
 * Rule-based DRAFT test case generator: normalized story → positive / negative / boundary cases
 * across UI, API and hybrid automation types.
 *
 * The output is a starting point. The `test-case-generator` Cursor skill (AI) enriches it, and a human
 * MUST review and approve cases (status: draft → approved in data/test-cases/catalogue.json) before code is written.
 */
import type { AcceptanceCriterion, NormalizedStory } from './story-reader.ts';

export type CaseType = 'positive' | 'negative' | 'boundary';
export type AutomationType = 'UI' | 'API' | 'Hybrid' | 'Manual';
export type Priority = 'P1' | 'P2' | 'P3';

export interface TestCase {
  id: string;
  storyKey: string;
  acId: string;
  type: CaseType;
  title: string;
  preconditions: string[];
  testData: Record<string, unknown>;
  steps: string[];
  expectedResults: string[];
  automationType: AutomationType;
  priority: Priority;
  status: 'draft' | 'approved' | 'rejected';
  reviewNotes?: string;
}

const UI_WORDS = /\b(shown|displayed|list|listed|dashboard|confirmation|confirm|cancel|indicator|page|screen|appears)\b/i;
const API_WORDS = /\b(saved|rejected|retrieved|error|returns?|id|timestamp|validation|not found|page size)\b/i;
const NEGATIVE_WORDS = /\b(rejected|invalid|required|error|not found|does not exist|cannot|unknown|missing)\b/i;

function priorityOf(story: NormalizedStory): Priority {
  return /highest|high|critical/i.test(story.priority) ? 'P1' : /low/i.test(story.priority) ? 'P3' : 'P2';
}

function automationTypeOf(text: string): AutomationType {
  const ui = UI_WORDS.test(text);
  const api = API_WORDS.test(text);
  if (ui && api) return 'Hybrid';
  if (ui) return 'UI';
  if (api) return 'API';
  return 'Manual';
}

/** Extract numeric ranges such as "between 1 and 120" or "up to 2000". */
function boundariesOf(text: string): { min?: number; max?: number; label: string }[] {
  const out: { min?: number; max?: number; label: string }[] = [];
  for (const m of text.matchAll(/between\s+(\d+)\s+and\s+(\d+)/gi)) out.push({ min: +m[1], max: +m[2], label: m[0] });
  for (const m of text.matchAll(/up to\s+(\d+)/gi)) out.push({ max: +m[1], label: m[0] });
  return out;
}

export function generateDraftTestCases(story: NormalizedStory): TestCase[] {
  const cases: TestCase[] = [];
  const priority = priorityOf(story);
  let n = 0;
  const next = () => `TC-${story.key}-${String(++n).padStart(3, '0')}`;
  const ambiguous = new Set(story.findings.filter((f) => f.rule === 'ambiguous-term').map((f) => f.scope));

  const add = (ac: AcceptanceCriterion, partial: Omit<TestCase, 'id' | 'storyKey' | 'acId' | 'status' | 'priority'> & { priority?: Priority }) =>
    cases.push({
      id: next(), storyKey: story.key, acId: ac.id, priority, status: 'draft',
      ...(ambiguous.has(ac.id) ? { reviewNotes: 'AC is ambiguous — clarify with Product Owner before automating.' } : {}),
      ...partial,
    });

  for (const ac of story.acceptanceCriteria) {
    const automationType = ambiguous.has(ac.id) ? 'Manual' : automationTypeOf(ac.text);
    add(ac, {
      type: 'positive',
      title: `${story.summary}: ${ac.id} happy path`,
      preconditions: ['TaskPilot UI and API are reachable', 'Test creates its own uniquely named data'],
      testData: { title: '<unique TPW-* title>' },
      steps: [`Perform the action described in ${ac.id}`, 'Observe the system response'],
      expectedResults: [ac.text],
      automationType,
    });

    if (NEGATIVE_WORDS.test(ac.text)) {
      add(ac, {
        type: 'negative',
        title: `${story.summary}: ${ac.id} rejects invalid input`,
        preconditions: ['TaskPilot API is reachable'],
        testData: { invalid: '<invalid value derived from AC>' },
        steps: ['Submit the invalid request', 'Verify the error response', 'Verify no data was changed'],
        expectedResults: ['Request is rejected with a validation or not-found error', 'Existing data is unchanged'],
        automationType: automationType === 'UI' ? 'UI' : 'API',
        priority: 'P2',
      });
    }

    for (const b of boundariesOf(ac.text)) {
      const values = [
        ...(b.min !== undefined ? [b.min - 1, b.min] : []),
        ...(b.max !== undefined ? [b.max, b.max + 1] : []),
      ].filter((v) => v >= 0);
      add(ac, {
        type: 'boundary',
        title: `${story.summary}: ${ac.id} boundary values (${b.label})`,
        preconditions: ['TaskPilot API is reachable'],
        testData: { values },
        steps: values.map((v) => `Submit a value of size ${v}`),
        expectedResults: values.map((v) =>
          (b.min !== undefined && v < b.min) || (b.max !== undefined && v > b.max) ? `${v}: rejected` : `${v}: accepted`),
        automationType: 'API',
        priority: 'P2',
      });
    }
  }
  return cases;
}

export function testCasesToMarkdown(story: NormalizedStory, cases: TestCase[]): string {
  const lines = [
    `# Draft test cases — ${story.key}: ${story.summary}`,
    '',
    '> Status: **DRAFT — requires human review before automation.**',
    '',
    '| ID | AC | Type | Automation | Priority | Title | Expected |',
    '|---|---|---|---|---|---|---|',
    ...cases.map((c) => `| ${c.id} | ${c.acId} | ${c.type} | ${c.automationType} | ${c.priority} | ${c.title} | ${c.expectedResults.join('<br>')} |`),
  ];
  return lines.join('\n') + '\n';
}
