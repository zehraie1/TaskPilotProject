import { test, expect } from '../../fixtures/test.ts';
import type { ApiError, Task } from '../../clients/task-api-client.ts';
import { expectSchema } from '../../utils/schema-validator.ts';
import { trace, verifyAC } from '../../utils/traceability.ts';
import { LIMITS, buildTask, isoDate, stringOfLength, titleOfLength, uniqueTitle } from '../../utils/test-data.ts';

test.describe('API · Create task (TP-101)', () => {
  test('create with only a title applies defaults', trace({ testCase: 'TC-API-010', covers: ['TP-101:AC1'], tags: ['@smoke', '@positive'] }), async ({ api, tasks }) => {
    const title = uniqueTitle('defaults');
    let created!: Task;

    await verifyAC('TP-101:AC1', 'POST /tasks with title only returns 201 and a valid task', 'HTTP 201, body matches task schema', async () => {
      const { status, body } = await api.createTask({ title });
      tasks.track(body.id);
      expect(status).toBe(201);
      expectSchema('task', body);
      created = body;
      return `HTTP ${status}, id=${body.id}`;
    });

    await verifyAC('TP-101:AC1', 'Defaults are applied', 'status=pending, priority=medium, description/due_date null', async () => {
      expect(created).toMatchObject({ title, status: 'pending', priority: 'medium', description: null, due_date: null });
      return `status=${created.status}, priority=${created.priority}`;
    });

    await verifyAC('TP-101:AC1', 'Task is retrievable by its new id', 'GET /tasks/{id} returns the same task', async () => {
      const { status, body } = await api.getTask(created.id);
      expect(status).toBe(200);
      expect(body).toEqual(created);
      return `HTTP ${status}`;
    });
  });

  test('create with every field persists the values exactly', trace({ testCase: 'TC-API-011', covers: ['TP-101:AC3'], tags: ['@positive'] }), async ({ api, tasks }) => {
    const input: Record<string, unknown> = { ...buildTask({ description: 'Full payload ✓ — üñíçødé', status: 'in_progress', priority: 'high', due_date: isoDate(30) }) };

    await verifyAC('TP-101:AC3', 'All optional fields are saved as entered', 'response echoes every submitted field', async () => {
      const { status, body } = await api.createTask(input);
      tasks.track(body.id);
      expect(status).toBe(201);
      expectSchema('task', body);
      expect(body).toMatchObject(input);
      return `HTTP ${status}, ${JSON.stringify({ status: body.status, priority: body.priority, due_date: body.due_date })}`;
    });
  });

  // Data-driven boundary analysis for title length (OpenAPI: minLength 1, maxLength 120)
  const titleBoundaries = [
    { length: LIMITS.titleMin, expected: 201 },
    { length: LIMITS.titleMax, expected: 201 },
    { length: LIMITS.titleMax + 1, expected: 422 },
  ];
  for (const { length, expected } of titleBoundaries) {
    test(`title length ${length} → HTTP ${expected}`, trace({ testCase: 'TC-API-012', covers: ['TP-101:AC2'], tags: ['@boundary'] }), async ({ api, tasks }) => {
      // Length 1 cannot carry the run prefix; it is cleaned up by id like every other task.
      const title = length === 1 ? 'Z' : titleOfLength(length);
      await verifyAC('TP-101:AC2', `Title of ${length} characters`, `HTTP ${expected}`, async () => {
        const { status, body } = await api.createTask({ title });
        if (status === 201) tasks.track((body as Task).id);
        expect(status).toBe(expected);
        if (expected === 201) expect((body as Task).title).toBe(title);
        else expectSchema('error', body);
        return `HTTP ${status}`;
      });
    });
  }

  const invalidTitles: { name: string; payload: Record<string, unknown> }[] = [
    { name: 'missing title', payload: { description: 'no title' } },
    { name: 'empty title', payload: { title: '' } },
    { name: 'null title', payload: { title: null } },
    { name: 'whitespace-only title', payload: { title: '   ' } },
  ];
  for (const { name, payload } of invalidTitles) {
    test(`rejects ${name}`, trace({ testCase: 'TC-API-013', covers: ['TP-101:AC2'], tags: ['@negative'] }), async ({ api, tasks }) => {
      await verifyAC('TP-101:AC2', `POST with ${name} is rejected`, 'HTTP 422 with validation_error envelope', async () => {
        const { status, body } = await api.createTask(payload);
        if (status === 201) tasks.track((body as unknown as Task).id);
        expect(status).toBe(422);
        expectSchema('error', body);
        expect((body as unknown as ApiError).error.code).toBe('validation_error');
        return `HTTP ${status}, code=${(body as unknown as ApiError).error.code}`;
      });
    });
  }

  test('description length boundary (2000 ok, 2001 rejected)', trace({ testCase: 'TC-API-014', covers: ['TP-101:AC3'], tags: ['@boundary'] }), async ({ api, tasks }) => {
    await verifyAC('TP-101:AC3', 'Description of 2000 characters is accepted', 'HTTP 201', async () => {
      const { status, body } = await api.createTask(buildTask({ description: stringOfLength(LIMITS.descriptionMax) }));
      tasks.track(body.id);
      expect(status).toBe(201);
      expect(body.description).toHaveLength(LIMITS.descriptionMax);
      return `HTTP ${status}`;
    });
    await verifyAC('TP-101:AC3', 'Description of 2001 characters is rejected', 'HTTP 422', async () => {
      const { status, body } = await api.createTask(buildTask({ description: stringOfLength(LIMITS.descriptionMax + 1) }));
      if (status === 201) tasks.track((body as Task).id);
      expect(status).toBe(422);
      expectSchema('error', body);
      return `HTTP ${status}`;
    });
  });

  const invalidFields: { name: string; patch: Record<string, unknown> }[] = [
    { name: 'unknown status', patch: { status: 'done' } },
    { name: 'unknown priority', patch: { priority: 'urgent' } },
    { name: 'malformed due date', patch: { due_date: '15/01/2030' } },
  ];
  for (const { name, patch } of invalidFields) {
    test(`rejects ${name}`, trace({ testCase: 'TC-API-015', covers: ['TP-101:AC3'], tags: ['@negative'] }), async ({ api, tasks }) => {
      const title = uniqueTitle('invalid');
      await verifyAC('TP-101:AC3', `POST with ${name} is rejected`, 'HTTP 422 and no task created', async () => {
        const { status, body } = await api.createTask({ title, ...patch });
        if (status === 201) tasks.track((body as Task).id);
        expect(status).toBe(422);
        expectSchema('error', body);
        expect(await api.findByTitle(title)).toHaveLength(0);
        return `HTTP ${status}, no task persisted`;
      });
    });
  }
});
