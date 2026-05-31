import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/blockraft/' : '/',
  root: '.',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
  worker: {
    format: 'es',
  },
}));
