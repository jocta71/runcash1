import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  },
  // Configuração para o servidor de desenvolvimento
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://backendapi-production-36b5.up.railway.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  // Configuração para produção
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production'
  }
}); 