// Script de diagnóstico para localizar o arquivo websocket_server.js
const fs = require('fs');
const path = require('path');

console.log("=== RunCash Websocket File Finder ===");
console.log("Diretório atual:", process.cwd());

// Listar todos os arquivos no diretório atual
try {
  console.log("\n=== Arquivos no diretório atual ===");
  const files = fs.readdirSync(process.cwd());
  console.log(files);
} catch (err) {
  console.error("Erro ao listar diretório atual:", err);
}

// Listar todos os arquivos no diretório pai
try {
  console.log("\n=== Arquivos no diretório pai ===");
  const parentFiles = fs.readdirSync(path.join(process.cwd(), '..'));
  console.log(parentFiles);
} catch (err) {
  console.error("Erro ao listar diretório pai:", err);
}

// Listar todos os arquivos no diretório /app
try {
  console.log("\n=== Arquivos no diretório /app ===");
  const appFiles = fs.readdirSync('/app');
  console.log(appFiles);
} catch (err) {
  console.error("Erro ao listar diretório /app:", err);
}

// Buscar manualmente nos diretórios comuns
console.log("\n=== Busca pelo websocket_server.js ===");
let websocketFilePath = null;

const commonDirs = [
  process.cwd(),
  path.join(process.cwd(), '..'),
  '/app',
  '/app/backend',
  '/usr/src/app'
];

for (const dir of commonDirs) {
  try {
    console.log(`Verificando em ${dir}...`);
    
    // Verifica se o diretório existe
    if (fs.existsSync(dir)) {
      const dirFiles = fs.readdirSync(dir);
      console.log(`Conteúdo de ${dir}:`, dirFiles);
      
      // Verificar se o arquivo existe neste diretório
      if (dirFiles.includes('websocket_server.js')) {
        websocketFilePath = path.join(dir, 'websocket_server.js');
        console.log(`>>> ENCONTRADO: ${websocketFilePath}`);
      }
    } else {
      console.log(`Diretório ${dir} não existe`);
    }
  } catch (err) {
    console.error(`Erro ao verificar ${dir}:`, err.message);
  }
}

// Resumo dos resultados
console.log("\n=== RESULTADO DA BUSCA ===");
if (websocketFilePath) {
  console.log(`Arquivo encontrado em: ${websocketFilePath}`);
} else {
  console.log("Nenhuma instância de websocket_server.js foi encontrada nos diretórios comuns");
}

// Exibir algumas variáveis de ambiente para diagnóstico (apenas as seguras)
console.log("\n=== Variáveis de ambiente relevantes ===");
console.log({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  PATH: process.env.PATH,
  PWD: process.env.PWD,
  HOME: process.env.HOME,
  RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME,
  RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME
}); 