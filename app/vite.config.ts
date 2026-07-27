import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Относительная база: сборка одинаково работает и в корне домена, и в подпапке
  // (например, на GitHub Pages по адресу /<repo>/).
  base: './',
  server: {
    host: true,
  },
});
