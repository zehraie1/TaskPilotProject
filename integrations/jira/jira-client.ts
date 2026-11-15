/**
 * Thin Jira Cloud REST API v3 client using Node's built-in fetch (no SDK dependency).
 * Auth: Basic <email:api_token> — credentials come ONLY from environment variables / CI secrets.
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { env } from '../../config/env.ts';
import type { AdfNode } from './adf.ts';

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: AdfNode | string | null;
    issuetype?: { name: string };
    status?: { name: string };
    priority?: { name: string };
    labels?: string[];
    attachment?: { id: string; filename: string; size: number }[];
    [field: string]: unknown;
  };
}

export interface JiraComment {
  id: string;
  body: AdfNode;
}

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(baseUrl = env.jira.baseUrl, email = env.jira.email, token = env.jira.apiToken) {
    if (!baseUrl || !email || !token) {
      throw new Error('Connected Jira mode requires JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN.');
    }
    this.baseUrl = baseUrl;
    this.authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  }

  /** JQL search (enhanced search endpoint, token pagination). */
  async search(jql: string, fields: string[]): Promise<JiraIssue[]> {
    const out: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    do {
      const res = await this.json<{ issues: JiraIssue[]; nextPageToken?: string }>('/rest/api/3/search/jql', {
        method: 'POST',
        body: JSON.stringify({ jql, fields, maxResults: 100, ...(nextPageToken ? { nextPageToken } : {}) }),
      });
      out.push(...res.issues);
      nextPageToken = res.nextPageToken;
    } while (nextPageToken);
    return out;
  }

  createIssue(fields: Record<string, unknown>): Promise<{ id: string; key: string }> {
    return this.json('/rest/api/3/issue', { method: 'POST', body: JSON.stringify({ fields }) });
  }

  updateIssue(key: string, fields: Record<string, unknown>): Promise<null> {
    return this.json(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ fields }) });
  }

  linkIssues(type: string, inwardKey: string, outwardKey: string): Promise<null> {
    return this.json('/rest/api/3/issueLink', {
      method: 'POST',
      body: JSON.stringify({ type: { name: type }, inwardIssue: { key: inwardKey }, outwardIssue: { key: outwardKey } }),
    });
  }

  getIssueDetails(key: string): Promise<JiraIssue> {
    return this.json(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,labels,issuelinks,attachment,parent`);
  }

  get browseBase(): string {
    return `${this.baseUrl}/browse/`;
  }

  getIssue(key: string): Promise<JiraIssue> {
    return this.json(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,description,issuetype,status,priority,labels,attachment`);
  }

  async getComments(key: string): Promise<JiraComment[]> {
    const res = await this.json<{ comments: JiraComment[] }>(`/rest/api/3/issue/${encodeURIComponent(key)}/comment?maxResults=100&orderBy=-created`);
    return res.comments;
  }

  addComment(key: string, body: AdfNode): Promise<JiraComment> {
    return this.json(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, { method: 'POST', body: JSON.stringify({ body }) });
  }

  async addAttachment(key: string, filePath: string, fileName = basename(filePath)): Promise<{ id: string; filename: string }[]> {
    const form = new FormData();
    form.append('file', new Blob([await readFile(filePath)]), fileName);
    return this.json(`/rest/api/3/issue/${encodeURIComponent(key)}/attachments`, {
      method: 'POST',
      body: form,
      headers: { 'X-Atlassian-Token': 'no-check' },
    });
  }

  /** Remote link (e.g. GitHub Actions run). globalId makes it idempotent: same id = update, not duplicate. */
  addRemoteLink(key: string, globalId: string, url: string, title: string): Promise<unknown> {
    return this.json(`/rest/api/3/issue/${encodeURIComponent(key)}/remotelink`, {
      method: 'POST',
      body: JSON.stringify({ globalId, object: { url, title } }),
    });
  }

  private async json<T>(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
    const isForm = init.body instanceof FormData;
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
        ...(isForm || !init.body ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
    if (!res.ok) {
      // Never echo the request (it carries the auth header); include only status + Jira's message.
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Jira ${init.method ?? 'GET'} ${path.split('?')[0]} failed: HTTP ${res.status} ${detail}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
}
