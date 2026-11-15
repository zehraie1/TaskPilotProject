// Launch Playwright Codegen against the configured TaskPilot UI.
//   npm run codegen                 → records against UI_BASE_URL (.env) or the hosted app
//   npm run codegen -- http://localhost:5173
// Recordings are saved to generated/codegen/ (git-ignored) — review & refactor before moving into tests/.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const url = process.argv[2] ?? process.env.UI_BASE_URL ?? 'https://taskpilot-web.onrender.com';
const out = `generated/codegen/recording-${new Date().toISOString().replace(/[:.]/g, '-')}.spec.ts`;
mkdirSync('generated/codegen', { recursive: true });
console.log(`Recording against ${url}\nOutput: ${out}`);
const child = spawn('npx', ['playwright', 'codegen', '--target', 'playwright-test', '--test-id-attribute', 'data-testid', '--viewport-size', '1280,800', '-o', out, url], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
