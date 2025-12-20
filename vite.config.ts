import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the existing code
      'process.env': {
        AWS_REGION: env.AWS_REGION,
        AWS_BUCKET_NAME: env.AWS_BUCKET_NAME,
        AWS_ACCESS_KEY_ID: env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: env.AWS_SECRET_ACCESS_KEY,
        API_KEY: env.API_KEY
      }
    }
  };
});