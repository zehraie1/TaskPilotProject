/**
 * Detects missing or ambiguous requirements so they are raised BEFORE tests are generated.
 */
export type FindingSeverity = 'blocker' | 'warning' | 'info';

export interface RequirementFinding {
  severity: FindingSeverity;
  scope: string; // "story" or an AC id
  rule: string;
  message: string;
}

const VAGUE_TERMS = [
  'fast', 'quick', 'quickly', 'user-friendly', 'user friendly', 'intuitive', 'easy', 'simple', 'appropriate',
  'appropriately', 'reasonable', 'etc', 'and so on', 'as needed', 'if possible', 'should be nice', 'robust',
  'efficient', 'seamless', 'properly', 'correctly', 'some', 'various', 'many', 'tbd', 'tbc',
];
const OBSERVABLE = /\b(shows?|consistent|displayed|shown|listed|saved|rejected|returned|appears|removed|kept|retrieved|asks|error|refresh(?:es|ed)?|status|contains|between|up to)\b/i;

export function analyzeRequirements(
  story: { userStory: string; acceptanceCriteria: { id: string; text: string }[]; notes: string[] },
): RequirementFinding[] {
  const findings: RequirementFinding[] = [];

  if (!story.userStory) {
    findings.push({ severity: 'warning', scope: 'story', rule: 'missing-user-story', message: 'No "As a … I want … so that …" statement found.' });
  }
  if (!story.acceptanceCriteria.length) {
    findings.push({ severity: 'blocker', scope: 'story', rule: 'missing-acceptance-criteria', message: 'Story has no acceptance criteria; tests cannot be traced.' });
  }

  for (const ac of story.acceptanceCriteria) {
    const lower = ac.text.toLowerCase();
    const vague = VAGUE_TERMS.filter((t) => new RegExp(`\\b${t.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i').test(lower));
    if (vague.length) {
      findings.push({
        severity: 'warning', scope: ac.id, rule: 'ambiguous-term',
        message: `Ambiguous wording (${vague.join(', ')}). Ask the Product Owner for a measurable expectation.`,
      });
    }
    if (!OBSERVABLE.test(ac.text)) {
      findings.push({ severity: 'warning', scope: ac.id, rule: 'no-observable-outcome', message: 'No observable/verifiable outcome detected.' });
    }
    if (/\b(should|may|might|could)\b/i.test(ac.text)) {
      findings.push({ severity: 'info', scope: ac.id, rule: 'weak-modal-verb', message: 'Uses a weak modal verb (should/may/might/could); confirm whether it is mandatory.' });
    }
    if (ac.text.length < 25) {
      findings.push({ severity: 'warning', scope: ac.id, rule: 'too-short', message: 'Criterion is very short and probably under-specified.' });
    }
  }

  for (const note of story.notes) {
    if (/\b(tbd|tbc|todo|open question|\?)/i.test(note)) {
      findings.push({ severity: 'warning', scope: 'story', rule: 'open-question', message: `Open question in story notes: "${note}"` });
    }
  }
  return findings;
}
