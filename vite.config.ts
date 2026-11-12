import { defineConfig } from 'vite';
import { streamPlugin } from './server/stream-plugin.ts';

export default defineConfig({
  // GitHub Pages serves the project from /<repo>/; the workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [streamPlugin()],
  server: { port: 3000, strictPort: false },
  preview: { port: 4173 },
});
