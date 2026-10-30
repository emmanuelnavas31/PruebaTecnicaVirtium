import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo /api se redirige al backend; en Docker lo hace nginx.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
