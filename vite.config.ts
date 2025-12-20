
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env vars regardless of the `VITE_` prefix.
  // Fix: Use casting for process to avoid TS property 'cwd' errors in some environments
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Map API_KEY specifically to process.env as required by the Gemini SDK rules
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
    }
  };
});
