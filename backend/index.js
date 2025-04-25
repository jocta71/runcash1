// Arquivo de entrada para o Railway
// Este arquivo tentará localizar e carregar o websocket_server.js

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";

// Inicializar Express
const app = express();

// Importar rotas da API
const aiAnalysisRoutes = require('./api/ai-analysis');
const premiumRoutes = require('./routes/premiumRoutes');
const empresarialRoutes = require('./routes/empresarialRoutes');
const assinaturaRoutes = require('./routes/assinaturaRoutes');
const rouletteRoutes = require('./routes/rouletteRoutes');

// Importar serviço de carregamento em lotes
const batchDataService = require('./services/batchDataService');

// Middlewares
app.use(cors());
app.use(express.json());

// Configurar rotas da API
app.use('/api/ai', aiAnalysisRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/empresarial', empresarialRoutes);
app.use('/api/assinatura', assinaturaRoutes);
app.use('/api', rouletteRoutes);

// Adicionar rota para o carregamento em lotes otimizado
app.get('/api/roulettes-batch', async (req, res) => {
  try {
    const {
      limit = 200,
      page = 0,
      rouletteId = null,
      format = 'full',
      skipCache = false
    } = req.query;
    
    console.log(`[API] Recebida requisição para carregamento em lotes. Page: ${page}, Limit: ${limit}, Format: ${format}`);
    
    const result = await batchDataService.loadRoulettesInBatches({
      limit: parseInt(limit),
      page: parseInt(page),
      roletaId: rouletteId,
      skipCache: skipCache === 'true',
      format
    });
    
    res.json(result);
  } catch (error) {
    console.error('[API] Erro ao processar carregamento em lotes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar requisição',
      message: error.message
    });
  }
});

// Rota para obter todas as roletas disponíveis
app.get('/api/roulettes-list', async (req, res) => {
  try {
    const includeStatus = req.query.status === 'true';
    const roletas = await batchDataService.getAllRoulettes(includeStatus);
    
    res.json({
      success: true,
      data: roletas,
      count: roletas.length
    });
  } catch (error) {
    console.error('[API] Erro ao listar roletas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar roletas',
      message: error.message
    });
  }
});

// Rota para limpar cache do serviço de lotes
app.post('/api/roulettes-batch/clear-cache', async (req, res) => {
  try {
    const result = batchDataService.clearCache();
    res.json(result);
  } catch (error) {
    console.error('[API] Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache',
      message: error.message
    });
  }
});

// Rota principal para verificação
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash API Server',
    timestamp: new Date().toISOString()
  });
});

// Inicializar servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configurar eventos do Socket.IO
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Novo cliente conectado: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Cliente desconectado: ${socket.id}`);
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`[Server] API e servidor WebSocket iniciados na porta ${PORT}`);
  console.log(`[Server] API IA disponível em /api/ai`);
  console.log(`[Server] API Premium disponível em /api/premium`);
  console.log(`[Server] API Empresarial disponível em /api/empresarial`);
  console.log(`[Server] API Assinatura disponível em /api/assinatura`);
  console.log(`[Server] API Roletas disponível em /api/roulettes`);
});

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