#!/usr/bin/env node
/**
 * 确保 Electron 二进制与 path.txt 就绪（pnpm 可能跳过 postinstall 或安装不完整）
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const electronDir = path.join(rootDir, 'node_modules', 'electron');
const pathFile = path.join(electronDir, 'path.txt');
const electronExe = path.join(electronDir, 'dist', 'electron.exe');

if (!fs.existsSync(path.join(electronDir, 'install.js'))) {
  process.exit(0);
}

const needsInstall =
  !fs.existsSync(pathFile) ||
  !fs.existsSync(electronExe);

if (needsInstall) {
  const result = spawnSync(process.execPath, ['install.js'], {
    cwd: electronDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_MIRROR:
        process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(pathFile) && fs.existsSync(electronExe)) {
  fs.writeFileSync(pathFile, process.platform === 'win32' ? 'electron.exe' : 'electron');
}
