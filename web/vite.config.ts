import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento o front roda no Vite (5173) e fala com a API (3000).
// Em producao a propria API serve o front, na mesma porta.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/status': 'http://localhost:3000',
    },
  },
});
