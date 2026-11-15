/**
 * Typed TaskPilot API client built on Playwright's APIRequestContext.
 * Endpoints verified against the live OpenAPI document (/openapi.json).
 * Methods return the raw status and parsed body so tests can assert positive AND negative behaviour.
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ApiEvidenceLog } from '../utils/evidence.ts';
import type { TaskInput, TaskPriority, TaskStatus } from '../utils/test-data.ts';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskList {
  items: Task[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  by_priority: Record<TaskPriority, number>;
  recent_activity: Task[];
}

export interface ApiError {
  error: { code: string; message: string; details: unknown[] };
}

export interface ListParams {
  search?: string;
  status?: TaskStatus;
  sort_by?: 'created_at' | 'updated_at' | 'due_date' | 'title' | 'priority';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ApiResult<T> {
  status: number;
  body: T;
  response: APIResponse;
}

export const API_PATHS = {
  health: '/health',
  tasks: '/api/v1/tasks',
  task: (id: string) => `/api/v1/tasks/${encodeURIComponent(id)}`,
  dashboardSummary: '/api/v1/dashboard/summary',
} as const;

export class TaskApiClient {
  private readonly request: APIRequestContext;
  private readonly log?: ApiEvidenceLog;

  constructor(request: APIRequestContext, log?: ApiEvidenceLog) {
    this.request = request;
    this.log = log;
  }

  health() {
    return this.call<{ status: string }>('GET', API_PATHS.health);
  }

  listTasks(params: ListParams = {}) {
    return this.call<TaskList>('GET', API_PATHS.tasks, { params: params as Record<string, string | number> });
  }

  createTask(data: Partial<TaskInput> | Record<string, unknown>) {
    return this.call<Task>('POST', API_PATHS.tasks, { data });
  }

  getTask(id: string) {
    return this.call<Task>('GET', API_PATHS.task(id));
  }

  updateTask(id: string, data: Partial<TaskInput> | Record<string, unknown>) {
    return this.call<Task>('PATCH', API_PATHS.task(id), { data });
  }

  deleteTask(id: string) {
    return this.call<null>('DELETE', API_PATHS.task(id));
  }

  dashboardSummary() {
    return this.call<DashboardSummary>('GET', API_PATHS.dashboardSummary);
  }

  /** Find tasks whose title matches exactly (search is server-side "contains"). */
  async findByTitle(title: string): Promise<Task[]> {
    const { body } = await this.listTasks({ search: title, limit: 100 });
    return body.items.filter((t) => t.title === title);
  }

  private async call<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    options: { data?: unknown; params?: Record<string, string | number> } = {},
  ): Promise<ApiResult<T>> {
    const started = Date.now();
    const response = await this.request.fetch(url, { method, data: options.data, params: options.params });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    this.log?.add({
      at: new Date(started).toISOString(),
      method,
      url: response.url(),
      requestBody: options.data,
      status: response.status(),
      durationMs: Date.now() - started,
      responseBody: body,
    });
    return { status: response.status(), body: body as T, response };
  }
}
