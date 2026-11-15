/**
 * Removes secrets and personal data before anything is attached to a report or published to Jira.
 */
const SENSITIVE_KEYS = /^(authorization|cookie|set-cookie|x-api-key|api[-_]?key|token|access[-_]?token|refresh[-_]?token|password|secret|email)$/i;
const INLINE_PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, 'Bearer [REDACTED]'],
  [/Basic\s+[A-Za-z0-9+/]+=*/g, 'Basic [REDACTED]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]'],
  [/ATATT[A-Za-z0-9_\-=]+/g, '[REDACTED_JIRA_TOKEN]'],
];

export function sanitizeString(value: string): string {
  return INLINE_PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), value);
}

export function sanitize<T>(value: T): T {
  if (typeof value === 'string') return sanitizeString(value) as T;
  if (Array.isArray(value)) return value.map((v) => sanitize(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : sanitize(v);
    }
    return out as T;
  }
  return value;
}
