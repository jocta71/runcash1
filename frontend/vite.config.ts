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
        target: 'https://starfish-app-fubxw.ondigitalocean.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        secure: false,
      },
      // Websocket proxy se necessário
      '/socket.io': {
        target: 'https://starfish-app-fubxw.ondigitalocean.app',
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
    // Aumentar o limite de aviso para chunks grandes
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      external: ['@rollup/rollup-linux-x64-gnu'],
      output: {
        manualChunks: (id) => {
          // Vendor chunks - bibliotecas principais
          if (id.includes('node_modules')) {
            if (id.includes('react') || 
                id.includes('react-dom') || 
                id.includes('react-router')) {
              return 'vendor-react';
            }
            
            if (id.includes('@tanstack') || 
                id.includes('axios') || 
                id.includes('date-fns')) {
              return 'vendor-data';
            }
            
            if (id.includes('tailwind') || 
                id.includes('class-variance-authority') || 
                id.includes('lucide-react') ||
                id.includes('clsx')) {
              return 'vendor-ui';
            }
            
            // Outros node_modules
            return 'vendor-misc';
          }
          
          // Componentes de UI
          if (id.includes('/components/ui/')) {
            return 'ui-components';
          }
          
          // Componentes específicos de roletas
          if (id.includes('/components/roulette/')) {
            return 'roulette-components';
          }
          
          // Páginas
          if (id.includes('/pages/')) {
            // Extrair o nome da página do caminho
            const pageName = id.split('/pages/')[1]?.split('/')[0] || '';
            if (pageName) {
              return `page-${pageName}`;
            }
          }
          
          // Serviços
          if (id.includes('/services/')) {
            return 'services';
          }
          
          // Contextos
          if (id.includes('/context/')) {
            return 'contexts';
          }
        }
      },
    },
  }
}));
