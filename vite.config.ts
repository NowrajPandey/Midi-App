import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Capacitor loads the built app from the local filesystem on-device,
// so everything must be referenced with relative paths.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
