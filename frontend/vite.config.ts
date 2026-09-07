import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // Defaults to a locally running backend; set VITE_DEV_API_PROXY to test
        // the dev server against a deployed environment instead.
        target: process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
