import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyScramjetAssetsPlugin(): Plugin {
  return {
    name: 'copy-scramjet-runtime-assets',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(outDir)) return;

      const mounts: Array<{ from: string; to: string }> = [
        {
          from: path.resolve(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist'),
          to: path.resolve(outDir, 'scramjet'),
        },
        {
          from: path.resolve(__dirname, 'node_modules/@mercuryworkshop/scramjet-controller/dist'),
          to: path.resolve(outDir, 'controller'),
        },
        {
          from: path.resolve(__dirname, 'node_modules/@mercuryworkshop/epoxy-transport/dist'),
          to: path.resolve(outDir, 'epoxy'),
        },
        {
          from: path.resolve(__dirname, 'node_modules/@mercuryworkshop/libcurl-transport/dist'),
          to: path.resolve(outDir, 'libcurl'),
        },
      ];

      for (const { from, to } of mounts) {
        if (fs.existsSync(from)) {
          fs.cpSync(from, to, { recursive: true, force: true });
        }
      }

      const epgSnapshot = path.resolve(__dirname, '.epg-cache.json');
      if (fs.existsSync(epgSnapshot)) {
        fs.copyFileSync(epgSnapshot, path.resolve(outDir, 'epg-cache.json'));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const openRouterKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';

  return {
    define: {
      'process.env.OPENROUTER_API_KEY': JSON.stringify(openRouterKey),
    },
    envPrefix: ['VITE_', 'OPENROUTER_'],
    plugins: [
      react(),
      tailwindcss(),
      copyScramjetAssetsPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // Allow AI Studio dev/published previews, Cloudflare Pages, Vercel, custom domains, and tunnels
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
