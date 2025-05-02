import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Adicionar aliases se necessário
    },
  },
  optimizeDeps: {
    include: ['react-toastify'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Configurações específicas do Rollup, se necessário
    },
  },
}) 