#!/usr/bin/env node
/**
 * 确保 Electron 二进制与 path.txt 就绪（pnpm 可能跳过 postinstall 或安装不完整）
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(rootDir, 'node_modules', 'electron');
const pathFile = path.join(electronDir, 'path.txt');

function getPlatformPath() {
  switch (process.platform) {
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'linux':
      return 'electron';
    case 'win32':
      return 'electron.exe';
    default:
      return 'electron';
  }
}

const platformPath = getPlatformPath();
const electronBinary = path.join(electronDir, 'dist', platformPath);

if (!fs.existsSync(path.join(electronDir, 'install.js'))) {
  process.exit(0);
}

const needsInstall =
  !fs.existsSync(pathFile) ||
  !fs.existsSync(electronBinary);

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

if (!fs.existsSync(pathFile) && fs.existsSync(electronBinary)) {
  fs.writeFileSync(pathFile, platformPath);
}
