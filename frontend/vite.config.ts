import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Dev: gọi /api/* được proxy sang backend Node (mặc định :4000)
    proxy: { '/api': 'http://localhost:4000' },
  },
});
