import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Definir NODE_ENV explicitamente para o build
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
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
        },
        // Configuração de proxy para contornar problemas de CORS
        '/api-remote': {
          target: 'https://backendscraper-production.up.railway.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-remote/, ''),
          secure: false
        },
        // Configurar proxy para API para evitar CORS
        '/api-proxy': {
          target: 'https://backendapi-production-36b5.up.railway.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-proxy/, ''),
          secure: false,
        }
      },
    },
    // Configuração para garantir que o HTML5 History API funcione
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        },
      },
    }
  };
});
