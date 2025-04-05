import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Custom plugin to handle initialization
    {
      name: 'handle-global-init',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'global-init' || id === './global-init' || id === '../global-init') {
          return path.resolve(__dirname, 'src/global-init.js');
        }
        return null;
      }
    },
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "global-init": path.resolve(__dirname, "./src/global-init.js")
    },
  },
  // Ensure proper module loading order
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      input: {
        // The order here matters - globalInit should be first
        globalInit: path.resolve(__dirname, 'src/global-init.js'),
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        // Make sure Yo is available in the global scope
        intro: 'window.Yo = window.Yo || { initialized: true };',
        // Chunks configuration for better loading order
        manualChunks: (id) => {
          // Put initialization code in a separate chunk that loads first
          if (id.includes('global-init') || id.includes('preload')) {
            return 'init';
          }
          // Vendor chunk for libraries
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
          // UI components
          if (id.includes('/components/ui')) {
            return 'ui';
          }
          return undefined;
        },
      },
    },
  },
  // Define compilation-time constants to help with conditional code
  define: {
    '__GLOBAL_YO_INITIALIZED__': true,
  },
  // Configure the server in development
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
  }
});
