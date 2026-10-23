import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // CHANGED: 'http://localhost:5000' -> 'http://127.0.0.1:5000'
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})