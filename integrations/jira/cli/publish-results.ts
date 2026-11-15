/**
 * Usage:
 *   npm run jira:publish -- TP-101            → DRY RUN (default): prints what would be posted, writes reports/jira/*.dry-run.json
 *   npm run jira:publish -- TP-101 --approve  → publishes ONLY if JIRA_PUBLISH_ENABLED=true and JIRA_MODE credentials exist
 *   npm run jira:publish -- --all [--approve] → every story that has executed tests in the last run
 */
import { env } from '../../../config/env.ts';
import { buildPlan, loadCoverage, publish } from '../evidence-publisher.ts';

const args = process.argv.slice(2);
const approve = args.includes('--approve');
const report = loadCoverage();
const keys = args.includes('--all')
  ? [...new Set(report.rows.filter((r) => r.status === 'Passed' || r.status === 'Failed').map((r) => r.story))]
  : args.filter((a) => !a.startsWith('--'));

if (!keys.length) {
  console.error('Usage: npm run jira:publish -- <ISSUE-KEY ...> | --all  [--approve]');
  process.exit(2);
}
if (approve && !env.jira.publishEnabled) {
  console.error('Refusing to publish: --approve was given but JIRA_PUBLISH_ENABLED is not "true". Running as dry run.');
}

let failed = false;
for (const key of keys) {
  const plan = buildPlan(report, key);
  const result = await publish(plan, approve);
  console.log(`\n━━ ${key} · ${result.mode.toUpperCase()} · run ${plan.runId}`);
  if (result.mode === 'dry-run') {
    console.log(plan.commentPreview.split('\n').map((l) => `  │ ${l}`).join('\n'));
    console.log(`  Attachments that would be uploaded: ${plan.attachments.map((a) => a.name).join(', ') || 'none'}`);
    console.log(`  Remote link: ${plan.remoteLink?.url ?? 'none (not running in CI)'}`);
  } else {
    console.log(`  comment: ${result.comment}`);
    for (const a of result.attachments) console.log(`  attachment ${a.name}: ${a.outcome}`);
    console.log(`  remote link: ${result.remoteLink}`);
  }
  if (result.error) {
    failed = true;
    console.error(`  ERROR: ${result.error}`);
  }
}
console.log('\nPublishing records written to reports/jira/');
process.exit(failed ? 1 : 0);
