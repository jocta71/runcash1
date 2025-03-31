// Script de diagnóstico para localizar o arquivo websocket_server.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Tentar encontrar o arquivo no sistema
try {
  console.log("\n=== Busca pelo websocket_server.js ===");
  console.log("Tentando executar find...");
  
  let findResult;
  try {
    // Tenta usar find para localizar o arquivo
    findResult = execSync('find / -name "websocket_server.js" -type f 2>/dev/null').toString();
    console.log("Resultados do find:", findResult);
  } catch (error) {
    console.log("Comando find não disponível ou erro ao executar:", error.message);
    
    // Se o find não estiver disponível, tentamos outra abordagem
    console.log("Tentando localizar manualmente em diretórios comuns...");
    
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
            console.log(`>>> ENCONTRADO: ${path.join(dir, 'websocket_server.js')}`);
          }
        } else {
          console.log(`Diretório ${dir} não existe`);
        }
      } catch (err) {
        console.error(`Erro ao verificar ${dir}:`, err.message);
      }
    }
  }
} catch (err) {
  console.error("Erro na busca:", err);
}

// Exibir variáveis de ambiente para diagnóstico
console.log("\n=== Variáveis de ambiente ===");
console.log(process.env); 