/**
 * Global setup: wait until the TaskPilot API is healthy before any test starts.
 * Render free-tier services can "cold start", so we poll /health instead of sleeping blindly.
 */
import { request } from '@playwright/test';
import { env } from './env.ts';

export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + env.healthTimeoutSeconds * 1000;
  const api = await request.newContext({ baseURL: env.apiBaseUrl });
  let lastError = 'no response';
  try {
    while (Date.now() < deadline) {
      try {
        const res = await api.get('/health', { timeout: 30_000 });
        if (res.ok() && (await res.json()).status === 'ok') {
          console.log(`[global-setup] API healthy at ${env.apiBaseUrl} (run ${env.runId})`);
          return;
        }
        lastError = `HTTP ${res.status()}`;
      } catch (error) {
        lastError = (error as Error).message;
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000)); // polling interval, not a test sleep
    }
    throw new Error(`TaskPilot API not healthy within ${env.healthTimeoutSeconds}s: ${lastError}`);
  } finally {
    await api.dispose();
  }
}
