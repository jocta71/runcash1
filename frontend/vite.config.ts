import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' && 
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Configuração para o proxy de desenvolvimento
    proxy: {
      // Proxy para API principal (ROULETTES e outros endpoints)
      '/api': {
        target: 'https://backendapi-production-36b5.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        secure: false,
      },
      // Websocket proxy se necessário
      '/socket.io': {
        target: 'https://backend-production-2f96.up.railway.app',
        changeOrigin: true,
        ws: true,
        secure: false,
      }
    },
  },
  // Configuração para garantir que o HTML5 History API funcione
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      external: ['@rollup/rollup-linux-x64-gnu'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@/components/ui'], 
        },
      },
    },
  }
}));
