/**
 * Usage: npm run jira:read -- TP-101 [--mode fixture|connected]
 * Prints the normalized story + requirement findings and caches it to generated/stories/<KEY>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env, type JiraMode } from '../../../config/env.ts';
import { readStory, STORY_CACHE_DIR } from '../story-reader.ts';

const args = process.argv.slice(2);
const key = args.find((a) => !a.startsWith('--'));
const modeIdx = args.indexOf('--mode');
const mode = (modeIdx >= 0 ? args[modeIdx + 1] : env.jira.mode) as JiraMode;
if (!key) {
  console.error('Usage: npm run jira:read -- <ISSUE-KEY> [--mode fixture|connected]');
  process.exit(2);
}

const story = await readStory(key, mode);
mkdirSync(STORY_CACHE_DIR, { recursive: true });
const out = join(STORY_CACHE_DIR, `${story.key}.json`);
writeFileSync(out, JSON.stringify(story, null, 2));

console.log(`\n${story.key} — ${story.summary}  [mode: ${mode}, priority: ${story.priority}]`);
console.log(`\nUser story:\n  ${story.userStory || '(missing)'}`);
console.log('\nAcceptance criteria:');
for (const ac of story.acceptanceCriteria) console.log(`  ${ac.ref}  ${ac.text}`);
console.log('\nRequirement findings:');
if (!story.findings.length) console.log('  none');
for (const f of story.findings) console.log(`  [${f.severity.toUpperCase()}] ${f.scope} ${f.rule}: ${f.message}`);
console.log(`\nNormalized story written to ${out}`);
