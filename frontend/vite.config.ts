import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const https = process.env.HTTPS === 'true'
  ? { key: readFileSync(resolve('..', 'ssl', 'localhost-key.pem')), cert: readFileSync(resolve('..', 'ssl', 'localhost.pem')) }
  : undefined;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico'],
      workbox: {
        // The background-removal WASM/model is huge and loaded on demand — never precache it.
        globIgnores: ['**/ort-*.wasm', '**/*.onnx', '**/*.bin'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'CodigoAR',
        short_name: 'CodigoAR',
        description: 'Base colaborativa de productos por código de barras',
        theme_color: '#2E7D4F',
        background_color: '#fafaf9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    https,
    host: process.env.HTTPS === 'true' ? '0.0.0.0' : undefined,
    proxy: process.env.HTTPS === 'true' ? {
      '/api': { target: 'https://localhost:3443', secure: false },
      '/uploads': { target: 'https://localhost:3443', secure: false },
    } : {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
