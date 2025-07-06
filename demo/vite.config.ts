import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  const useServer = process.env.VITE_USE_SERVER === 'true'
  return {
    plugins: [react()],
    server: {
      port: 3021,
      ...(useServer ? {
        proxy: {
          '/ws': {
            target: 'ws://localhost:3020',
            ws: true,
            changeOrigin: true
          }
        }
      } : {})
    }
  }
})
