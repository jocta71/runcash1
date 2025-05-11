/**
 * Script para iniciar e monitorar o servidor websocket
 * Com suporte para reinicialização automática em caso de falha
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== RunCash Websocket Server ===');
console.log('Iniciando o serviço de websocket...');
console.log('Diretório atual:', process.cwd());
console.log('Arquivos no diretório atual:', fs.readdirSync('.'));

// Verificar existência do arquivo
let websocketFile = 'websocket_server_fix.js';
if (!fs.existsSync(websocketFile)) {
  console.log(`ERRO: Não foi possível encontrar o arquivo ${websocketFile}`);
  console.log('Buscando em diretórios comuns...');
  
  // Tentar encontrar o arquivo em locais comuns
  const possiblePaths = [
    'websocket_server_fix.js',
    './websocket_server_fix.js',
    './websocket/websocket_server_fix.js',
    './services/websocket_server_fix.js'
  ];
  
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      websocketFile = testPath;
      console.log(`Arquivo encontrado em: ${testPath}`);
      break;
    }
  }
  
  if (!fs.existsSync(websocketFile)) {
    console.log('Arquivo websocket_server_fix.js não encontrado em nenhum local conhecido');
    process.exit(1);
  }
}

// Obter porta do ambiente ou usar padrão
const PORT = process.env.WEBSOCKET_PORT || process.env.PORT || 8080;
console.log(`Porta não definida, usando padrão: ${PORT}`);

// Função para iniciar o servidor
function startServer() {
  console.log(`Iniciando o servidor de websocket com arquivo: ${websocketFile}`);
  
  // Definir variáveis de ambiente para o processo filho
  const env = { ...process.env, WEBSOCKET_PORT: PORT };
  
  // Iniciar o processo filho com o arquivo do servidor websocket
  const serverProcess = spawn('node', [websocketFile], { 
    env,
    stdio: 'inherit',
    shell: true
  });
  
  // Gerenciar eventos do processo
  serverProcess.on('error', (err) => {
    console.error('Erro ao iniciar o processo:', err);
    setTimeout(startServer, 5000);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`Processo finalizado com código: ${code}`);
    console.log('Tentando reiniciar em 5 segundos...');
    setTimeout(startServer, 5000);
  });
}

// Iniciar o servidor
startServer(); 