/**
 * Evidence helpers: step screenshots for UI, sanitized request/response logs for API.
 */
import { writeFileSync } from 'node:fs';
import { test, type Page } from '@playwright/test';
import { env } from '../config/env.ts';
import { sanitize } from './sanitize.ts';

/**
 * Attach a named screenshot to the current test.
 * By default only captured in "full" evidence mode; pass `force` for screenshots that are always valuable.
 */
export async function stepScreenshot(page: Page, name: string, force = false): Promise<void> {
  if (!force && env.evidence !== 'full') return;
  // Saved as a file (not an in-memory body) so reporters and the Jira sync can reference the evidence path.
  const info = test.info();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const path = info.outputPath(`step-${String(info.attachments.length + 1).padStart(2, '0')}-${slug}.png`);
  await page.screenshot({ path, fullPage: false });
  await info.attach(`screenshot: ${name}`, { path, contentType: 'image/png' });
}

export interface ApiExchange {
  at: string;
  method: string;
  url: string;
  requestBody?: unknown;
  status: number;
  durationMs: number;
  responseBody?: unknown;
}

/** In-memory log of API calls for one test; attached (sanitized) on failure or in full evidence mode. */
export class ApiEvidenceLog {
  readonly exchanges: ApiExchange[] = [];

  add(exchange: ApiExchange): void {
    this.exchanges.push(sanitize(exchange));
  }

  async attachTo(name = 'api-exchanges.json'): Promise<void> {
    if (!this.exchanges.length) return;
    const info = test.info();
    const path = info.outputPath(name);
    writeFileSync(path, JSON.stringify(this.exchanges, null, 2));
    await info.attach(name, { path, contentType: 'application/json' });
  }
}
