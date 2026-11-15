/**
 * Usage: npm run jira:generate -- TP-101 [--mode fixture|connected]
 * Writes DRAFT test cases + traceability metadata to generated/test-cases/. Review before automating.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env, type JiraMode } from '../../../config/env.ts';
import { readStory } from '../story-reader.ts';
import { generateDraftTestCases, testCasesToMarkdown } from '../test-case-generator.ts';

const args = process.argv.slice(2);
const key = args.find((a) => !a.startsWith('--'));
const modeIdx = args.indexOf('--mode');
const mode = (modeIdx >= 0 ? args[modeIdx + 1] : env.jira.mode) as JiraMode;
if (!key) {
  console.error('Usage: npm run jira:generate -- <ISSUE-KEY> [--mode fixture|connected]');
  process.exit(2);
}

const story = await readStory(key, mode);
const blockers = story.findings.filter((f) => f.severity === 'blocker');
if (blockers.length) {
  console.error(`Cannot generate test cases for ${key}: ${blockers.map((b) => b.message).join('; ')}`);
  process.exit(1);
}

const cases = generateDraftTestCases(story);
const dir = join(import.meta.dirname, '..', '..', '..', 'generated', 'test-cases');
mkdirSync(dir, { recursive: true });
const traceability = {
  storyKey: story.key,
  generatedAt: new Date().toISOString(),
  source: story.source,
  findings: story.findings,
  acceptanceCriteria: story.acceptanceCriteria.map((ac) => ({
    ...ac,
    testCases: cases.filter((c) => c.acId === ac.id).map((c) => c.id),
  })),
  testCases: cases,
};
writeFileSync(join(dir, `${key}.draft.json`), JSON.stringify(traceability, null, 2));
writeFileSync(join(dir, `${key}.draft.md`), testCasesToMarkdown(story, cases));

console.log(`Generated ${cases.length} DRAFT test case(s) for ${key}:`);
for (const c of cases) console.log(`  ${c.id}  ${c.acId}  ${c.type.padEnd(8)} ${c.automationType.padEnd(6)} ${c.priority}  ${c.title}`);
if (story.findings.length) console.log(`\n⚠ ${story.findings.length} requirement finding(s) — resolve before approving.`);
console.log(`\nWritten: generated/test-cases/${key}.draft.json and .md — review, then promote approved cases to data/test-cases/catalogue.json`);
