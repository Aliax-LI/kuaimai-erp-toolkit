import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Node/Electron 内置模块 + 不宜打包的 native 依赖 */
const external = [
  'electron',
  'electron/main',
  'ali-oss',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(rootDir, 'src/shared'),
    },
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      external,
    },
  },
});
