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
const axios = require('axios'); // Adicionado para fazer proxy de requisições

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const API_SERVICE_URL = process.env.API_SERVICE_URL || "https://backendapi-production-36b5.up.railway.app";

// Inicializar Express
const app = express();

// Importar rotas da API
const aiAnalysisRoutes = require('./api/ai-analysis');
const premiumRoutes = require('./routes/premiumRoutes');
const empresarialRoutes = require('./routes/empresarialRoutes');
const assinaturaRoutes = require('./routes/assinaturaRoutes');
const rouletteRoutes = require('./routes/rouletteRoutes');

// Importar middlewares de autenticação e autorização
let authMiddleware = { proteger: (req, res, next) => next() };
let subscriptionMiddleware = { verificarPlano: () => (req, res, next) => next() };

// Tentar carregar os middlewares reais
try {
  authMiddleware = require('./middlewares/authMiddleware');
  console.log('✅ Middleware de autenticação carregado com sucesso');
} catch (error) {
  console.warn('⚠️ Não foi possível carregar o middleware de autenticação:', error.message);
}

try {
  subscriptionMiddleware = require('./middlewares/unifiedSubscriptionMiddleware');
  console.log('✅ Middleware de verificação de assinatura carregado com sucesso');
} catch (error) {
  console.warn('⚠️ Não foi possível carregar o middleware de verificação de assinatura:', error.message);
}

// Desestruturar os métodos que precisamos
const { proteger } = authMiddleware;
const { verificarPlano } = subscriptionMiddleware;

// Middlewares
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Função para fazer proxy de requisições para a API
const proxyRequest = async (req, res) => {
  try {
    const method = req.method.toLowerCase();
    const url = `${API_SERVICE_URL}${req.originalUrl}`;
    
    console.log(`[PROXY] Redirecionando ${method.toUpperCase()} ${req.originalUrl} para ${url}`);
    
    // Preservar headers da requisição original
    const headers = { ...req.headers };
    
    // Remover headers de host para evitar conflitos
    delete headers.host;
    
    // Fazer requisição para o serviço da API
    const response = await axios({
      method,
      url,
      headers,
      data: method !== 'get' ? req.body : undefined,
      validateStatus: () => true, // Não lançar erro para status codes não-2xx
      responseType: 'arraybuffer' // Para lidar com todos os tipos de respostas
    });
    
    // Definir status code da resposta
    res.status(response.status);
    
    // Copiar headers da resposta
    Object.entries(response.headers).forEach(([key, value]) => {
      // Não copiar content-length pois Express vai recalcular
      if (key.toLowerCase() !== 'content-length') {
        res.set(key, value);
      }
    });
    
    // Determinar o tipo de conteúdo e enviar resposta apropriada
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      const data = JSON.parse(response.data.toString('utf8'));
      res.json(data);
    } else {
      res.send(response.data);
    }
  } catch (error) {
    console.error('[PROXY] Erro ao redirecionar requisição:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar requisição',
      error: error.message
    });
  }
};

// Configurar rotas da API
app.use('/api/ai', aiAnalysisRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/empresarial', empresarialRoutes);
app.use('/api/assinatura', assinaturaRoutes);
app.use('/api', rouletteRoutes);

// Middleware de verificação de autorização para todas as requisições de API
app.use('/api/*', proteger, (req, res, next) => {
  // Verificar planos conforme o recurso
  if (req.originalUrl.includes('/strategy')) {
    return verificarPlano(['BASIC', 'PRO', 'PREMIUM'])(req, res, next);
  } else if (req.originalUrl.includes('/history')) {
    return verificarPlano(['BASIC', 'PRO', 'PREMIUM'])(req, res, next);
  } else {
    next();
  }
});

// Proxy para todas as requisições de API
app.all('/api/*', proxyRequest);

// Rota principal para verificação
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash API Server',
    timestamp: new Date().toISOString()
  });
});

// Rota de status do proxy
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash API Proxy Server',
    apiServiceUrl: API_SERVICE_URL,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
  console.log(`[Server] Proxy para API configurado para ${API_SERVICE_URL}`);
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