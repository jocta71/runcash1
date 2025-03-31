// Script para iniciar o serviço de websocket com resiliência
// Compatível com Railway e Windows

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log("=== RunCash Websocket Server ===");
console.log("Iniciando o serviço de websocket...");

// Verificar a estrutura de diretórios
console.log("Diretório atual:", process.cwd());
try {
  const files = fs.readdirSync(process.cwd());
  console.log("Arquivos no diretório atual:", files);
} catch (err) {
  console.error("Erro ao listar diretórios:", err);
}

// Detectar localização do arquivo websocket_server.js
let websocketFile = null;
const possiblePaths = [
  'websocket_server.js',
  path.join('..', 'websocket_server.js'),
  path.join('/app', 'websocket_server.js'),
  path.join('/app', 'backend', 'websocket_server.js'),
  path.join(process.cwd(), 'websocket_server.js'),
  path.join(process.cwd(), '..', 'websocket_server.js')
];

for (const filePath of possiblePaths) {
  try {
    if (fs.existsSync(filePath)) {
      websocketFile = filePath;
      console.log(`Arquivo de websocket encontrado: ${filePath}`);
      break;
    }
  } catch (err) {
    // Ignorar erros
  }
}

if (!websocketFile) {
  console.error("ERRO: Não foi possível encontrar o arquivo websocket_server.js");
  console.log("Buscando em diretórios comuns...");
  
  try {
    // No Linux/Unix
    const searchResult = execSync('find / -name "websocket_server.js" -type f 2>/dev/null').toString();
    console.log("Resultados da busca:", searchResult);
    
    if (searchResult.trim()) {
      websocketFile = searchResult.split('\n')[0].trim();
      console.log(`Arquivo encontrado via busca: ${websocketFile}`);
    }
  } catch (err) {
    console.log("Erro na busca:", err.message);
  }
}

if (!websocketFile) {
  console.error("ERRO FATAL: Não foi possível localizar websocket_server.js");
  console.log("Verifique se o arquivo existe e tente novamente.");
  process.exit(1);
}

// Configurar variáveis de ambiente se necessário
if (!process.env.PORT) {
  process.env.PORT = 8080;
  console.log(`Porta não definida, usando padrão: ${process.env.PORT}`);
}

// Iniciar o servidor com resiliência
console.log(`Iniciando o servidor de websocket com arquivo: ${websocketFile}`);

// Função para iniciar o processo Node
function startNode() {
  const nodeProcess = spawn('node', [websocketFile], {
    stdio: 'inherit',
    env: process.env
  });

  nodeProcess.on('close', (code) => {
    console.log(`Processo finalizado com código: ${code}`);
    if (code !== 0) {
      console.log("Tentando reiniciar em 5 segundos...");
      setTimeout(startNode, 5000);
    }
  });

  nodeProcess.on('error', (err) => {
    console.error("Erro ao iniciar processo:", err);
    console.log("Tentando reiniciar em 5 segundos...");
    setTimeout(startNode, 5000);
  });
}

// Iniciar o servidor
startNode(); 