import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The shared packages are plain TS source (no build step). We alias their
// package names straight to their source entry points and allow Vite's dev
// server to read files from the monorepo root so it can serve them.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mtt/engine': path.resolve(__dirname, '../packages/engine/src/index.ts'),
      '@mtt/theme': path.resolve(__dirname, '../packages/theme/src/index.ts'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
