import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const { PORT = '4000' } = loadEnv(mode, process.cwd(), '');
  return { plugins: [react()], server: { proxy: { '/api': { target: 'http://127.0.0.1:' + PORT, changeOrigin: false } } } };
});
