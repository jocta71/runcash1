const path = require('path');

module.exports = {
  plugins: [],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      // Garantir compatibilidade com o Vercel
      external: [
        '@rollup/rollup-linux-x64-gnu',
        '@rollup/rollup-darwin-x64'
      ],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['./src/components/ui'], 
        },
      },
    },
  }
}; 