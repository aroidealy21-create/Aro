import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4173',
      '/photos': 'http://localhost:4173'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
