#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const steps = [
  ['node', ['scripts/generate-app-icons.mjs']],
  ['vite', ['build', '--config', 'vite.main.config.ts']],
  ['vite', ['build', '--config', 'vite.preload.config.ts']],
  ['vite', ['build', '--config', 'vite.renderer.config.ts']],
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
