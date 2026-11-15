/**
 * Global teardown: safety net that removes any task created by THIS run that a test failed to clean up.
 * Matching is by the unique run prefix, so other users' data is never touched.
 */
import { request } from '@playwright/test';
import { env } from './env.ts';
import { runPrefix } from '../utils/test-data.ts';

export default async function globalTeardown(): Promise<void> {
  const api = await request.newContext({ baseURL: env.apiBaseUrl });
  const prefix = runPrefix();
  let removed = 0;
  try {
    const res = await api.get('/api/v1/tasks', { params: { search: prefix, limit: 100 } });
    if (!res.ok()) return;
    const { items } = (await res.json()) as { items: { id: string; title: string }[] };
    for (const task of items.filter((t) => t.title.startsWith(prefix))) {
      const del = await api.delete(`/api/v1/tasks/${task.id}`);
      if (del.status() === 204) removed++;
    }
    if (removed) console.log(`[global-teardown] removed ${removed} leftover task(s) for ${prefix}`);
  } finally {
    await api.dispose();
  }
}
