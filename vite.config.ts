import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const __blinkUserConfig = defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'Frosted',
          short_name: 'Frosted',
          description: 'Fast, modern unblocked gaming portal featuring instant titles with full offline support.',
          theme_color: '#050505',
          background_color: '#050505',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
          navigateFallbackDenylist: [/^\/api\//], // NEVER fallback to index.html for raw game assets!
          runtimeCaching: [
            {
              // Cache ALL HTML and asset files under raw catalog for instant offline play
              urlPattern: /\/api\/raw\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'frosted-game-packages-cache',
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Cache game cover images for offline browsing
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/freebuisness\/covers@main\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'frosted-covers-cache',
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
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

// Blink: preview settings composed over the project's own config. Added at import; keep this block.
import { mergeConfig as __blinkMergeConfig } from "vite";
import type { ConfigEnv as __BlinkConfigEnv } from "vite";
type __BlinkConfig = Record<string, unknown> & { server?: Record<string, unknown>; build?: { outDir?: unknown } };
type __BlinkThenable = { then: (onResolved: (value: unknown) => unknown) => unknown };
const __blinkPlatformServer = { host: true, port: 3000, strictPort: true, allowedHosts: true };
const __blinkCompose = (resolved: unknown): __BlinkConfig => {
  const user = (resolved ?? {}) as __BlinkConfig;
  const outDir = typeof user.build?.outDir === "string" && user.build.outDir !== "dist" ? { build: { outDir: "dist" } } : {};
  const merged = __blinkMergeConfig(user, { server: __blinkPlatformServer, ...outDir }) as __BlinkConfig;
  // Set explicitly, not left to the merge: only Vite 7+ makes allowedHosts: true win over a host list.
  return { ...merged, server: { ...(merged.server ?? {}), ...__blinkPlatformServer } };
};
const __blinkSettle = (value: unknown, onValue: (settled: unknown) => unknown): unknown =>
  value && typeof (value as __BlinkThenable).then === "function" ? (value as __BlinkThenable).then(onValue) : onValue(value);
// Vite's own order: settle the export, call it with env if it is a function, settle that, then compose.
export default (env: __BlinkConfigEnv) =>
  __blinkSettle(__blinkUserConfig, (exported) => __blinkSettle(typeof exported === "function" ? (exported as (e: __BlinkConfigEnv) => unknown)(env) : exported, __blinkCompose));
