import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const groqKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY || '';
  const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  return {
    define: {
      'process.env.GROQ_API_KEY': JSON.stringify(groqKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
    },
    envPrefix: ['VITE_', 'GROQ_', 'GEMINI_'],
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
