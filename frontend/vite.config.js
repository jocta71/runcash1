import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'react-toastify',
      '@emotion/react',
      '@emotion/styled',
      'lodash',
      'react-bootstrap',
      'react-bootstrap-icons'
    ],
    force: true // Forçar otimização mesmo se já estiver em cache
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignorar avisos específicos que não afetam a build
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' || 
            warning.message.includes('use client') || 
            warning.message.includes('@/components/ui/use-toast')) {
          return;
        }
        warn(warning);
      }
    },
  },
}) 