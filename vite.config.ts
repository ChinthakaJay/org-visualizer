import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/web',
  build: { outDir: '../../dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: {
    // `npm run dev` proxies the API to a server started with `npm run serve -- <file>`.
    proxy: { '/api': 'http://127.0.0.1:4317' },
  },
  test: {
    root: '.',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
