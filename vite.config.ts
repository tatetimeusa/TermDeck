import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // relative asset paths so the production build works when Electron loads it via file://
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
