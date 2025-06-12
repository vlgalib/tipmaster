import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001/tips-6545c/us-central1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TipMaster',
        short_name: 'TipMaster',
        description: 'Crypto Tips Made Simple. Powered by Base.',
        theme_color: '#0D111C',
        background_color: '#0D111C',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-512x512.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // 10 MB for XMTP WASM files
      }
    }),
  ],
  define: {
    global: 'globalThis',
    'globalThis': 'globalThis',
    'window.globalThis': 'globalThis',
    'self.globalThis': 'globalThis',
    'process.env': {},
    '__DEV__': JSON.stringify(process.env.NODE_ENV === 'development'),
    '__PROD__': JSON.stringify(process.env.NODE_ENV === 'production'),
    // Firebase compatibility defines
    'process.browser': true,
    'Buffer': 'buffer.Buffer',
  },
  resolve: {
    alias: {
      process: 'process/browser',
      stream: 'stream-browserify',
      util: 'util',
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    exclude: ["@xmtp/wasm-bindings", "@xmtp/browser-sdk"],
    include: ["@xmtp/proto", 'buffer', 'process'],
    esbuildOptions: {
      target: 'esnext',
      define: {
        global: 'globalThis',
      },
    },
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext',
    // Added source maps for debugging
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true,
      include: ['node_modules/**'],
    },
    rollupOptions: {
      external: [],
      output: {
        // Improved chunk handling for large libraries
        manualChunks: {
          vendor: ['react', 'react-dom'],
          xmtp: ['@xmtp/browser-sdk'],
          onchain: ['@coinbase/onchainkit'],
        },
      },
    },
  },
})
