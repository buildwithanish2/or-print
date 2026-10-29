import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.npm_execpath) throw new Error('Run this script with `npm run type-check` so npm can be invoked safely.');
const npmArgsPrefix = process.env.npm_execpath ? [process.env.npm_execpath] : [];
const npmExecutable = npmArgsPrefix.length ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');

function run(args, extraEnv = {}) {
  const result = spawnSync(npmExecutable, [...npmArgsPrefix, ...args], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const workspace of ['packages/types', 'packages/config', 'packages/validation']) {
  run(['run', 'build', `--workspace=${workspace}`]);
}
run(['run', 'generate', '--workspace=apps/api'], { DATABASE_URL: 'file:./build-only.db' });
run(['run', 'type-check', '--workspaces', '--if-present']);
