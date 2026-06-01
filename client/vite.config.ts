import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Allow access through tunnels / custom hosts (e.g. *.trycloudflare.com).
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      // Reverse-proxy the realtime broker so it shares the app's origin
      // (lets a single public tunnel serve app + API + WebSocket).
      '/pusher': {
        target: 'http://localhost:6001',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/pusher/, ''),
      },
    },
  },
});
