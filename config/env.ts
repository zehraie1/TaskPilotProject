/**
 * Central, typed access to environment configuration.
 * All URLs and credentials come from .env / CI secrets — never hard-code them in tests.
 */
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

// One run id per execution. Generated in the main Playwright process; workers inherit it via process.env.
process.env.TPW_RUN_ID ||= `${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}${Math.random().toString(36).slice(2, 5)}`;

function str(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export type EvidenceLevel = 'standard' | 'full';
export type JiraMode = 'fixture' | 'connected';

export const env = {
  uiBaseUrl: stripSlash(str('UI_BASE_URL', 'https://taskpilot-web.onrender.com')),
  apiBaseUrl: stripSlash(str('API_BASE_URL', 'https://taskpilot-api-k11v.onrender.com')),
  healthTimeoutSeconds: Number(str('HEALTH_TIMEOUT_SECONDS', '120')),
  evidence: (str('EVIDENCE', 'standard') === 'full' ? 'full' : 'standard') as EvidenceLevel,
  workers: Number(str('WORKERS', '3')),
  isCI: Boolean(process.env.CI),
  /** Unique id for this execution; used to namespace test data and de-duplicate Jira publishing. */
  runId: str('TPW_RUN_ID', ''),
  jira: {
    mode: (str('JIRA_MODE', 'fixture') === 'connected' ? 'connected' : 'fixture') as JiraMode,
    baseUrl: stripSlash(str('JIRA_BASE_URL', '')),
    email: str('JIRA_EMAIL', ''),
    apiToken: str('JIRA_API_TOKEN', ''),
    publishEnabled: str('JIRA_PUBLISH_ENABLED', 'false') === 'true',
  },
  ci: {
    sha: str('GITHUB_SHA', ''),
    runId: str('GITHUB_RUN_ID', ''),
    serverUrl: str('GITHUB_SERVER_URL', 'https://github.com'),
    repository: str('GITHUB_REPOSITORY', ''),
  },
} as const;

/** Link to the GitHub Actions run, when executing in CI. */
export function ciRunUrl(): string | undefined {
  const { serverUrl, repository, runId } = env.ci;
  return repository && runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : undefined;
}
