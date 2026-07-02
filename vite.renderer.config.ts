import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = __dirname;
const rendererRoot = path.resolve(projectRoot, 'src/renderer');

export default defineConfig({
  root: rendererRoot,
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // Forge 主进程从 `.vite/build/../renderer/main_window` 加载，输出须在项目根 `.vite/renderer/`
    outDir: path.resolve(projectRoot, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': rendererRoot,
      '@shared': path.resolve(projectRoot, 'src/shared'),
    },
  },
});
