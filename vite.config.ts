import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'data/*.json'],
        manifest: {
          name: 'Brainiac',
          short_name: 'Brainiac',
          description: 'The Ultimate Study Tool',
          theme_color: '#ffffff',
          icons: [
            {
              src: '/brainiac-logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/brainiac-logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/gdrive': {
          target: 'https://drive.google.com',
          changeOrigin: true,
          rewrite: (path) => {
            const id = path.replace(/^\/gdrive\//, '');
            return `/uc?export=download&id=${id}&confirm=t`;
          }
        }
      }
    },
  };
});
