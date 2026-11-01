import { defineConfig } from 'vite';
import { streamPlugin } from './server/stream-plugin.ts';

export default defineConfig({
  plugins: [streamPlugin()],
  server: { port: 3000, strictPort: false },
  preview: { port: 4173 },
});
