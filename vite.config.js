import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  root: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'esri-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /\/data\/.*\.geojson$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geojson-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      },
      manifest: {
        name: 'AeraField',
        short_name: 'AeraField',
        description: 'Mobile field navigation app',
        theme_color: '#14b8a6',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: 'any',
            type: 'image/x-icon'
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    port: 3000,
    host: true
  }
})