import { defineConfig } from 'vite';

// GH_PAGES_BASE is set by the deploy workflow to the repo name, so built asset URLs
// resolve under https://<user>.github.io/<repo>/ instead of the site root.
export default defineConfig({
  root: 'client',
  base: process.env.GH_PAGES_BASE || '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  preview: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
    environment: 'node',
    coverage: { include: ['server/**', 'client/src/lib/**', 'client/src/runtime/**'], exclude: ['server/index.js'] },
  },
});
