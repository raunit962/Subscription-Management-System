import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Proxy to the same PORT the server reads (server/.env, then root .env), default 4001
  const env = { ...loadEnv(mode, '..', ''), ...loadEnv(mode, '../server', '') };
  const apiPort = env.PORT || 4001;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
