import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Custom plugin to inject global-init.js at the beginning of the bundle
    {
      name: 'inject-global-init',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:global-init') {
          return id;
        }
        return null;
      },
      load(id) {
        if (id === 'virtual:global-init') {
          // This code will be injected at the beginning of the bundle
          return `
            // Initialize global variables to prevent "Cannot access before initialization" errors
            window.Yo = window.Yo || { initialized: true, timestamp: Date.now() };
            console.log('[vite] Global variables initialized');
          `;
        }
        return null;
      },
      transformIndexHtml(html) {
        // Add a script tag to the HTML to ensure variables are initialized before any other scripts
        return html.replace(
          '<head>',
          `<head>
            <script>
              // Pre-initialize variables that might be accessed before initialization
              window.Yo = { initialized: true, timestamp: Date.now() };
            </script>`
        );
      },
    },
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Add global-init.js as an entry point before the main entry
  optimizeDeps: {
    include: ['src/global-init.js'],
    entries: ['src/global-init.js', 'index.html'],
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
    // Ensure proper module loading order in the final bundle
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
  }
});
