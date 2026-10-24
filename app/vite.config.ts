import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Matches the "http" profile in api/src/TradeBlotter.Api/Properties/launchSettings.json.
const API_URL = process.env.API_URL ?? 'http://localhost:5035'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Same-origin /api calls in dev; avoids needing CORS on the API.
      '/api': {
        target: API_URL,
        changeOrigin: true,
      },
      // SignalR live feed (WebSocket upgrade, with negotiate over HTTP).
      '/hubs': {
        target: API_URL,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
