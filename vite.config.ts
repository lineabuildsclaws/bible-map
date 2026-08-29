import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths keep both a GitHub project page and local static preview working.
  base: './',
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  // MapLibre's worker is already bundled correctly for production. Excluding it
  // from Vite's dev optimizer prevents the optimizer from dropping its worker
  // module during local browser testing.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
