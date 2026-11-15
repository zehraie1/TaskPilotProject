import { test, expect } from '../../fixtures/test.ts';
import { expectSchema } from '../../utils/schema-validator.ts';
import { trace } from '../../utils/traceability.ts';

test.describe('API · Health', () => {
  test('health endpoint reports the service is up', trace({ testCase: 'TC-API-001', covers: [], tags: ['@smoke'] }), async ({ api }) => {
    await test.step('GET /health returns 200 and status "ok"', async () => {
      const { status, body } = await api.health();
      expect(status).toBe(200);
      expectSchema('health', body);
    });
  });
});
