/**
 * TaskFactory: creates tasks through the API and GUARANTEES cleanup.
 * Every created or adopted id is deleted in fixture teardown, even when the test fails.
 */
import { expect } from '@playwright/test';
import type { Task, TaskApiClient } from '../clients/task-api-client.ts';
import { buildTask, type TaskInput } from '../utils/test-data.ts';

export class TaskFactory {
  private readonly api: TaskApiClient;
  private readonly ids = new Set<string>();

  constructor(api: TaskApiClient) {
    this.api = api;
  }

  /** Create a task via API (arrange step) and register it for cleanup. */
  async create(overrides: Partial<TaskInput> = {}): Promise<Task> {
    const { status, body } = await this.api.createTask(buildTask(overrides));
    expect(status, 'precondition: task created via API').toBe(201);
    this.ids.add(body.id);
    return body;
  }

  /** Register a task created another way (e.g. through the UI) for cleanup. */
  track(id: string): void {
    this.ids.add(id);
  }

  /** Mark a task as already deleted by the test, so teardown does not expect it. */
  forget(id: string): void {
    this.ids.delete(id);
  }

  /** Locate a task created through the UI by its unique title and register it for cleanup. */
  async adoptByTitle(title: string): Promise<Task> {
    let found: Task[] = [];
    await expect
      .poll(async () => (found = await this.api.findByTitle(title)).length, {
        message: `task "${title}" should exist in the API`,
      })
      .toBe(1);
    this.track(found[0].id);
    return found[0];
  }

  async cleanup(): Promise<void> {
    const failures: string[] = [];
    for (const id of this.ids) {
      const { status } = await this.api.deleteTask(id);
      if (status !== 204 && status !== 404) failures.push(`${id} → HTTP ${status}`);
    }
    this.ids.clear();
    if (failures.length) throw new Error(`Cleanup failed for: ${failures.join(', ')}`);
  }
}
