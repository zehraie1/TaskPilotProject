/**
 * JSON Schema validation with Ajv. Schemas live in /schemas and are loaded once.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { expect } from '@playwright/test';

export type SchemaName = 'task' | 'task-list' | 'dashboard-summary' | 'error' | 'health';

const schemaDir = join(import.meta.dirname, '..', 'schemas');
const ajv = new Ajv2020({ allErrors: true, strict: false });
// ajv-formats ships CJS; normalise the default export for ESM.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule) as (a: Ajv2020) => void;
addFormats(ajv);

for (const file of readdirSync(schemaDir).filter((f) => f.endsWith('.schema.json'))) {
  ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, file), 'utf8')));
}

/** Returns a list of human-readable schema errors (empty when valid). */
export function validateSchema(name: SchemaName, data: unknown): string[] {
  const validate = ajv.getSchema(`${name}.schema.json`);
  if (!validate) throw new Error(`Schema not found: ${name}`);
  if (validate(data)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`);
}

/** Playwright-friendly assertion: fails with every schema violation listed. */
export function expectSchema(name: SchemaName, data: unknown): void {
  expect(validateSchema(name, data), `response should match ${name} schema`).toEqual([]);
}
