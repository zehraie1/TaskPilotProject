/**
 * Jira Story Reader: issue key → raw issue (fixture or connected) → normalized, analyzed requirements.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { env, type JiraMode } from '../../config/env.ts';
import { adfToText } from './adf.ts';
import { JiraClient, type JiraIssue } from './jira-client.ts';
import { analyzeRequirements, type RequirementFinding } from './requirements-analyzer.ts';

export const FIXTURE_DIR = join(import.meta.dirname, '..', '..', 'data', 'jira');
export const STORY_CACHE_DIR = join(import.meta.dirname, '..', '..', 'generated', 'stories');

export interface AcceptanceCriterion {
  id: string; // "AC1"
  ref: string; // "TP-101:AC1"
  text: string;
}

export interface NormalizedStory {
  key: string;
  summary: string;
  priority: string;
  status: string;
  labels: string[];
  userStory: string;
  acceptanceCriteria: AcceptanceCriterion[];
  notes: string[];
  findings: RequirementFinding[];
  source: { mode: JiraMode; retrievedAt: string };
}

export async function fetchIssue(key: string, mode: JiraMode = env.jira.mode): Promise<JiraIssue> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) throw new Error(`Invalid Jira issue key: "${key}"`);
  if (mode === 'connected') return new JiraClient().getIssue(key);
  const file = join(FIXTURE_DIR, `${key}.json`);
  if (!existsSync(file)) throw new Error(`No local fixture for ${key} (expected ${file}).`);
  return JSON.parse(readFileSync(file, 'utf8')) as JiraIssue;
}

/** Split description text into sections by headings; parse "AC<n>:" / Given-When-Then bullets. */
export function normalizeIssue(issue: JiraIssue, mode: JiraMode): NormalizedStory {
  const text = adfToText(issue.fields.description);
  const sections = new Map<string, string[]>();
  let current = 'body';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^(?:#+\s*|h\d\.\s*)?(user story|acceptance criteria|notes|out of scope)\s*:?\s*$/i);
    if (heading) {
      current = heading[1].toLowerCase();
      continue;
    }
    sections.set(current, [...(sections.get(current) ?? []), line.replace(/^[-*•]\s*/, '')]);
  }

  const acLines = sections.get('acceptance criteria') ?? [];
  const acceptanceCriteria = acLines.map((line, index) => {
    const m = line.match(/^(AC\s*-?\s*\d+)\s*[:.)-]\s*(.*)$/i);
    const id = m ? m[1].replace(/[\s-]/g, '').toUpperCase() : `AC${index + 1}`;
    return { id, ref: `${issue.key}:${id}`, text: (m ? m[2] : line).trim() };
  });

  const userStory = (sections.get('user story') ?? sections.get('body') ?? []).join(' ');
  const notes = sections.get('notes') ?? [];
  const base = {
    key: issue.key,
    summary: issue.fields.summary,
    priority: issue.fields.priority?.name ?? 'Medium',
    status: issue.fields.status?.name ?? 'Unknown',
    labels: issue.fields.labels ?? [],
    userStory,
    acceptanceCriteria,
    notes,
  };
  return { ...base, findings: analyzeRequirements(base), source: { mode, retrievedAt: new Date().toISOString() } };
}

export async function readStory(key: string, mode: JiraMode = env.jira.mode): Promise<NormalizedStory> {
  return normalizeIssue(await fetchIssue(key, mode), mode);
}

/**
 * Synchronous requirement registry used by the coverage reporter:
 * all local fixtures, overridden by stories cached from CONNECTED mode (generated/stories).
 */
export function loadRequirementRegistry(): NormalizedStory[] {
  const byKey = new Map<string, NormalizedStory>();
  for (const f of readdirSync(FIXTURE_DIR).filter((n) => n.endsWith('.json'))) {
    const issue = JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as JiraIssue;
    byKey.set(issue.key, normalizeIssue(issue, 'fixture'));
  }
  if (existsSync(STORY_CACHE_DIR)) {
    for (const f of readdirSync(STORY_CACHE_DIR).filter((n) => n.endsWith('.json'))) {
      const story = JSON.parse(readFileSync(join(STORY_CACHE_DIR, f), 'utf8')) as NormalizedStory;
      // Only connected-mode snapshots override fixtures; fixture-mode caches are always re-derived fresh.
      if (story.source.mode === 'connected') byKey.set(story.key, story);
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}
