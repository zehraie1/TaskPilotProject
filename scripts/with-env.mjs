// Cross-platform "KEY=value -- command" runner (avoids the cross-env dependency).
import { spawn } from 'node:child_process';

const sep = process.argv.indexOf('--');
const assignments = process.argv.slice(2, sep);
const [cmd, ...args] = process.argv.slice(sep + 1);
const env = { ...process.env };
for (const a of assignments) {
  const [k, ...v] = a.split('=');
  env[k] = v.join('=');
}
const child = spawn(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
