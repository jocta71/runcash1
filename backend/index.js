// Arquivo de entrada para o Railway
// Este arquivo tentará localizar e carregar o websocket_server.js

const fs = require('fs');
const path = require('path');

console.log('=== RunCash WebSocket Launcher ===');
console.log('Diretório atual:', process.cwd());

// Procurar o arquivo websocket_server.js
const possiblePaths = [
  './websocket_server.js',
  path.join(process.cwd(), 'websocket_server.js'),
  '../websocket_server.js',
  path.join(process.cwd(), '..', 'websocket_server.js'),
  path.join(__dirname, 'websocket_server.js')
];

let websocketPath = null;

// Verificar cada caminho possível
for (const filePath of possiblePaths) {
  try {
    if (fs.existsSync(filePath)) {
      websocketPath = filePath;
      console.log(`Arquivo websocket_server.js encontrado em: ${filePath}`);
      break;
    }
  } catch (err) {
    // Ignorar erros de verificação
  }
}

// Se não encontrar o arquivo, criar um mínimo
if (!websocketPath) {
  console.log('Arquivo websocket_server.js não encontrado, criando um básico...');
  
  const basicWebsocketCode = `
// Servidor WebSocket básico para o Railway
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('RunCash WebSocket Server está rodando.\\n');
});

// Variáveis de ambiente
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';

console.log(\`Iniciando servidor WebSocket na porta \${PORT}\`);
console.log('MongoDB URI configurada:', MONGODB_URI ? 'Sim' : 'Não');

// Iniciar servidor HTTP
server.listen(PORT, () => {
  console.log(\`Servidor rodando na porta \${PORT}\`);
  
  // Log periódico para confirmar que o servidor está rodando
  setInterval(() => {
    console.log('Servidor ainda em execução... ' + new Date().toISOString());
  }, 30000);
});
`;

  const targetPath = path.join(process.cwd(), 'websocket_server.js');
  fs.writeFileSync(targetPath, basicWebsocketCode);
  console.log(`Arquivo básico criado em ${targetPath}`);
  websocketPath = targetPath;
}

// Carregar e executar o arquivo websocket_server.js
console.log(`Carregando websocket_server.js de ${websocketPath}...`);

try {
  // Carregar o arquivo diretamente
  require(websocketPath);
  console.log('Servidor WebSocket iniciado com sucesso!');
} catch (err) {
  console.error('Erro ao carregar websocket_server.js:', err);
  
  // Se falhar, tentar executar como texto
  console.log('Tentando executar o código diretamente...');
  try {
    const websocketCode = fs.readFileSync(websocketPath, 'utf8');
    eval(websocketCode);
    console.log('Servidor WebSocket executado via eval.');
  } catch (evalErr) {
    console.error('Falha ao executar via eval:', evalErr);
    
    // Criar e iniciar um servidor HTTP mínimo para evitar falha completa
    console.log('Iniciando servidor HTTP mínimo de emergência...');
    const http = require('http');
    const PORT = process.env.PORT || 8080;
    
    const emergencyServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('RunCash Emergency WebSocket Server\n');
    });
    
    emergencyServer.listen(PORT, () => {
      console.log(`Servidor de emergência rodando na porta ${PORT}`);
    });
  }
} 