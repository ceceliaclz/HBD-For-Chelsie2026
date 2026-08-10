import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: '我们的地图',
        short_name: '我们的地图',
        theme_color: '#121826',
        background_color: '#121826',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html}',
          'geo/**/*.{json,geojson}',
          'data/**/*.json',
          'pwa-*.png',
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
