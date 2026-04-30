import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3333',
      '/uploads': 'http://localhost:3333',
      '/webhooks': 'http://localhost:3333',
      '/socket.io': {
        target: 'http://localhost:3333',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
