/**
 * Test data factory. Every value is unique per run + worker so tests never collide
 * on the shared TaskPilot database and never depend on seed data.
 */
import { randomUUID } from 'node:crypto';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

export const STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed'];
export const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high'];

/** UI labels used by TaskPilot for each API enum value. */
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };

/** Contract limits from OpenAPI (TaskCreate). */
export const LIMITS = { titleMin: 1, titleMax: 120, descriptionMax: 2000, pageLimitMin: 1, pageLimitMax: 100 } as const;

/** Prefix shared by every record created in this execution: TPW-<runId>. */
export function runPrefix(): string {
  return `TPW-${process.env.TPW_RUN_ID ?? 'local'}`;
}

/** Unique, human-readable title, e.g. "TPW-2611151530ab-w0-1a2b3c Create task". */
export function uniqueTitle(label = 'Task'): string {
  const worker = process.env.TEST_WORKER_INDEX ?? 'm';
  return `${runPrefix()}-w${worker}-${randomUUID().slice(0, 6)} ${label}`.slice(0, LIMITS.titleMax);
}

/** ISO date (YYYY-MM-DD) offset from today in UTC. */
export function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

/** Format an ISO date as TaskPilot renders it, e.g. "Jan 15, 2030". */
export function displayDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

/** Builder with sensible defaults; override only what the test cares about. */
export function buildTask(overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    title: uniqueTitle(),
    description: 'Created by TestPilot PW automation.',
    status: 'pending',
    priority: 'medium',
    due_date: isoDate(14),
    ...overrides,
  };
}

/** String of exact length — for boundary tests. */
export function stringOfLength(length: number, char = 'x'): string {
  return char.repeat(length);
}

/** Title with the run prefix padded to an exact length (still cleanable by prefix). */
export function titleOfLength(length: number): string {
  const base = `${uniqueTitle('B')} `;
  return base.length >= length ? base.slice(0, length) : base + 'x'.repeat(length - base.length);
}

/** A syntactically valid UUID that will not exist in the database. */
export function nonExistentId(): string {
  return randomUUID();
}
