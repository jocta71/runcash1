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

// Se não encontrou o arquivo, criar um websocket_server.js mínimo
if (!websocketFilePath) {
  console.log("\n=== CRIANDO ARQUIVO WEBSOCKET_SERVER.JS MÍNIMO ===");
  
  const minimumWebsocketContent = `
// Websocket Server mínimo para Railway
const http = require('http');
const socketIo = require('socket.io');

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('RunCash Websocket Server rodando!\n');
});

// Configurar Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Variáveis
const PORT = process.env.PORT || 8080;
const connectedClients = new Set();

// Manipulador de conexões
io.on('connection', (socket) => {
  console.log('Nova conexão: ' + socket.id);
  connectedClients.add(socket.id);
  
  // Enviar evento de boas-vindas
  socket.emit('message', { 
    type: 'info', 
    message: 'Conectado ao servidor websocket',
    timestamp: new Date().toISOString()
  });
  
  // Manipular mensagens recebidas
  socket.on('message', (data) => {
    console.log('Mensagem recebida:', data);
    
    // Simplesmente ecoar a mensagem de volta
    socket.emit('message', {
      type: 'echo',
      originalMessage: data,
      timestamp: new Date().toISOString()
    });
  });
  
  // Manipular desconexão
  socket.on('disconnect', () => {
    console.log('Cliente desconectado: ' + socket.id);
    connectedClients.delete(socket.id);
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(\`Servidor websocket rodando na porta \${PORT}\`);
  
  // Log de status a cada 30 segundos
  setInterval(() => {
    console.log(\`Clientes conectados: \${connectedClients.size}\`);
  }, 30000);
});
`;

  const targetPath = path.join(process.cwd(), 'websocket_server.js');
  
  try {
    fs.writeFileSync(targetPath, minimumWebsocketContent);
    console.log(`Arquivo criado em: ${targetPath}`);
    websocketFilePath = targetPath;
  } catch (err) {
    console.error(`Erro ao criar arquivo: ${err.message}`);
    
    // Tentar em /app como alternativa
    try {
      const appPath = '/app/websocket_server.js';
      fs.writeFileSync(appPath, minimumWebsocketContent);
      console.log(`Arquivo criado em: ${appPath}`);
      websocketFilePath = appPath;
    } catch (appErr) {
      console.error(`Erro ao criar arquivo em /app: ${appErr.message}`);
    }
  }
}

// Resumo dos resultados
console.log("\n=== RESULTADO DA BUSCA ===");
if (websocketFilePath) {
  console.log(`Arquivo encontrado/criado em: ${websocketFilePath}`);
  
  // Verificar se o socket.io está instalado
  try {
    console.log("\n=== Verificando dependências ===");
    require.resolve('socket.io');
    console.log("socket.io está instalado");
  } catch (err) {
    console.log("socket.io NÃO está instalado! Tentando instalar...");
    
    try {
      const { execSync } = require('child_process');
      execSync('npm install socket.io --no-save', { stdio: 'inherit' });
      console.log("socket.io instalado com sucesso!");
    } catch (installErr) {
      console.error("Erro ao instalar socket.io:", installErr.message);
      console.log("Por favor, instale manualmente: npm install socket.io");
    }
  }
} else {
  console.log("ERRO: Não foi possível encontrar ou criar websocket_server.js!");
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