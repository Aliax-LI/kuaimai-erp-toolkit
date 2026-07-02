import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Node/Electron 内置模块 */
const external = [
  'electron',
  'electron/main',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(rootDir, 'src/shared'),
    },
    // 使用 Node.js 解析条件，避免应用 browser 字段（ali-oss 有 browser shim）
    conditions: ['node', 'electron'],
    mainFields: ['main', 'module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      external,
    },
  },
});
