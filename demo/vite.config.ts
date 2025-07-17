import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  const useServer = process.env.VITE_USE_SERVER === 'true'
  return {
    plugins: [react()],
    server: {
      port: 3021,
      host: true,
      hmr: {
        // Enable HMR
        overlay: true,
        // Use same port for HMR WebSocket
        port: 3021,
        // Client-side HMR host
        host: 'localhost'
      },
      // Watch for changes in all files
      watch: {
        // Use polling on macOS for better file detection
        usePolling: process.platform === 'darwin',
        interval: 100
      },
      ...(useServer ? {
        proxy: {
          '/ws': {
            target: 'ws://localhost:3020',
            ws: true,
            changeOrigin: true
          }
        }
      } : {})
    },
    // Handle client-side routing
    appType: 'spa',
    // Optimize deps for faster HMR
    optimizeDeps: {
      include: ['react', 'react-dom', '@just-every/demo-ui'],
      exclude: ['@just-every/task']
    },
    // Clear screen on restart
    clearScreen: false
  }
})
