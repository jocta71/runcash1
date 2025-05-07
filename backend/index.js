// Arquivo de entrada unificado para o Railway
// Este arquivo carrega tanto a API principal quanto outros serviços

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { encryptRouletteData, verifyAccessKey } = require('./middlewares/encryptionMiddleware');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const JWT_SECRET = process.env.JWT_SECRET || "runcash_jwt_secret_key_2023";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "runcash_default_encryption_key_2024";

// Definir chave de criptografia no ambiente caso não exista
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  console.log('[Server] Chave de criptografia definida com valor padrão');
}

console.log('=== RunCash Unified Server ===');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log('Diretório atual:', process.cwd());

// Verificar e atualizar configuração do callback do Google
try {
  require('./update_google_callback');
  console.log('[Server] Verificação do callback do Google concluída');
} catch (err) {
  console.warn('[Server] Erro ao verificar callback do Google:', err.message);
}

// Inicializar Express para a API principal
const app = express();

// *** AUTENTICAÇÃO DESATIVADA PARA /api/roulettes ***
// Este middleware antes bloqueava acessos não autenticados, agora permite qualquer acesso
app.use(async (req, res, next) => {
  // Verificar se o caminho é exatamente /api/roulettes (completo ou normalizado)
  const path = req.originalUrl || req.url;
  const pathLower = path.toLowerCase();
  
  // Verificar todas as variações possíveis da rota (case insensitive)
  if (pathLower === '/api/roulettes' || 
      pathLower === '/api/roulettes/' ||
      pathLower.startsWith('/api/roulettes?') ||
      path === '/api/ROULETTES' ||
      path === '/api/ROULETTES/' ||
      path.startsWith('/api/ROULETTES?')) {
    
    // Gerar ID único para rastreamento do log
    const requestId = crypto.randomUUID();
    
    console.log(`[FIREWALL DESATIVADO ${requestId}] 🟢 Permitindo acesso livre à rota ${path}`);
    console.log(`[FIREWALL DESATIVADO ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[FIREWALL DESATIVADO ${requestId}] IP: ${req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    console.log(`[FIREWALL DESATIVADO ${requestId}] Timestamp: ${new Date().toISOString()}`);
    
    // Definir um usuário com role público, não admin, para permitir criptografia
    req.user = { 
      id: 'public-access',
      role: 'public',
      email: 'public@example.com',
      subscription: { status: 'free' }
    };
    
    // Permitir acesso direto sem verificar token ou assinatura
    return next();
  }
  
  // Se não for a rota específica, continuar para o próximo middleware
  next();
});

// Middlewares básicos
app.use(cors({
  origin: [
    'https://runcashh111.vercel.app',
    'https://runcash5.vercel.app', 
    'http://localhost:3000', 
    'http://localhost:5173', 
    'https://runcashh1.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 
                 'ngrok-skip-browser-warning', 'bypass-tunnel-reminder', 'cache-control', 'pragma'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Aplicar o middleware de verificação de chave de acesso e criptografia
app.use(verifyAccessKey);
app.use(encryptRouletteData);

// Carregar rotas de streaming
try {
  const streamRoutes = require('./routes/streamRoutes');
  app.use('/api/stream', streamRoutes);
  console.log('Rotas de streaming carregadas com sucesso');
} catch (err) {
  console.log('Rotas de streaming não disponíveis:', err.message);
}

// Carregar rotas de dados históricos
try {
  const historicalDataRoutes = require('./routes/historicalDataRoutes');
  app.use('/api/historical', historicalDataRoutes);
  console.log('Rotas de dados históricos carregadas com sucesso');
} catch (err) {
  console.log('Rotas de dados históricos não disponíveis:', err.message);
}

// Verificar se a pasta api existe e carregar o index.js da API
const apiIndexPath = path.join(__dirname, 'api', 'index.js');
if (fs.existsSync(apiIndexPath)) {
  console.log('Carregando API principal de api/index.js...');
  try {
    // Montar a API no caminho /api
    const apiApp = require('./api/index.js');
    app.use('/api', apiApp);
    console.log('API principal carregada com sucesso no caminho /api');
  } catch (err) {
    console.error('Erro ao carregar API principal:', err);
  }
} else {
  console.log('Arquivo api/index.js não encontrado, carregando rotas básicas...');
  
  // Importar algumas rotas diretas da API, se disponíveis
  try {
    if (fs.existsSync(path.join(__dirname, 'api', 'routes'))) {
      // Tentar carregar rotas individuais
      try {
        const rouletteHistoryRouter = require('./api/routes/rouletteHistoryApi');
        app.use('/api/roulettes/history', rouletteHistoryRouter);
        console.log('Rota /api/roulettes/history carregada');
      } catch (err) {
        console.log('Rota de histórico de roletas não disponível:', err.message);
      }
      
      try {
        const strategiesRouter = require('./api/routes/strategies');
        app.use('/api/strategies', strategiesRouter);
        console.log('Rota /api/strategies carregada');
      } catch (err) {
        console.log('Rota de estratégias não disponível:', err.message);
      }
    }
    
    // Carregar rotas de roleta do diretório principal
    try {
      const rouletteRoutes = require('./routes/rouletteRoutes');
      app.use('/api', rouletteRoutes);
      console.log('Rotas de roleta carregadas do diretório principal');
    } catch (err) {
      console.log('Rotas de roleta não disponíveis no diretório principal:', err.message);
    }
    
    // Carregar rotas de assinatura (incluindo acesso à chave de criptografia)
    try {
      const subscriptionRoutes = require('./routes/subscriptionRoutes');
      app.use('/api/subscription', subscriptionRoutes);
      console.log('Rotas de assinatura carregadas do diretório principal');
    } catch (err) {
      console.log('Rotas de assinatura não disponíveis no diretório principal:', err.message);
    }
  } catch (err) {
    console.error('Erro ao carregar rotas individuais:', err);
  }
}

// Configurar endpoints base para verificação
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash Unified Server',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash API',
    timestamp: new Date().toISOString()
  });
});

// Compatibilidade direta para autenticação Google
// Isso garante que as rotas de autenticação continuem funcionando mesmo com a mudança no diretório raiz
app.get('/auth/google', (req, res) => {
  console.log('[Compat] Redirecionando chamada /auth/google para /api/auth/google');
  res.redirect('/api/auth/google');
});

app.get('/auth/google/callback', (req, res, next) => {
  console.log('[Compat] Redirecionando callback Google para /api/auth/google/callback');
  // Ajustar a URL para o middleware de passport poder processar corretamente
  req.url = '/api/auth/google/callback';
  app._router.handle(req, res, next);
});

// Inicializar servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.IO básico
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

// Verificar se o websocket_server.js existe e deve ser carregado
const websocketPath = path.join(__dirname, 'websocket_server.js');
if (fs.existsSync(websocketPath)) {
  console.log('Arquivo websocket_server.js encontrado. Verificando se deve ser carregado...');
  
  // Verificar se alguma variável de ambiente determina se o websocket deve ser inicializado
  const shouldLoadWebsocket = process.env.ENABLE_WEBSOCKET === 'true';
  
  if (shouldLoadWebsocket) {
    console.log('Carregando websocket_server.js...');
    try {
      // Para evitar conflitos de porta, não carregamos diretamente
      // Em vez disso, extraímos a lógica necessária do arquivo websocket_server.js
      
      // Configuramos endpoints para compatibilidade com o websocket_server.js
      app.post('/emit-event', (req, res) => {
        try {
          const { event, data } = req.body;
          
          if (!event || !data) {
            return res.status(400).json({ error: 'Evento ou dados ausentes no payload' });
          }
          
          console.log(`[WebSocket] Recebido evento ${event}`);
          
          // Broadcast do evento para todos os clientes conectados
          io.emit(event, data);
          
          res.status(200).json({ success: true, message: 'Evento emitido com sucesso' });
        } catch (error) {
          console.error('[WebSocket] Erro ao processar evento:', error);
          res.status(500).json({ error: 'Erro interno ao processar evento' });
        }
      });
      
      console.log('Endpoint /emit-event configurado para compatibilidade com WebSocket');
    } catch (err) {
      console.error('Erro ao configurar compatibilidade WebSocket:', err);
    }
  } else {
    console.log('WebSocket desativado pelas variáveis de ambiente.');
  }
} else {
  console.log('Arquivo websocket_server.js não encontrado, funcionalidade WebSocket não estará disponível.');
}

// Carregar outros serviços fora da pasta /api
// Exemplo: scraper, jobs, etc.
try {
  // Verificar e carregar serviços conforme necessário
  const servicesPath = path.join(__dirname, 'services');
  if (fs.existsSync(servicesPath)) {
    console.log('Diretório de serviços encontrado, verificando serviços disponíveis...');
    
    // Listar arquivos no diretório services
    const serviceFiles = fs.readdirSync(servicesPath);
    console.log('Serviços disponíveis:', serviceFiles);
    
    // Aqui você pode adicionar lógica para carregar cada serviço necessário
  }
} catch (err) {
  console.error('Erro ao carregar serviços adicionais:', err);
}

// Após registrar todas as rotas, antes de iniciar o servidor
// Listar todas as rotas registradas para depuração
function printRegisteredRoutes(app) {
  console.log('\n=== ROTAS REGISTRADAS ===');
  
  const printRoutes = (stack, basePath = '') => {
    stack.forEach(layer => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods)
          .filter(method => layer.route.methods[method])
          .map(method => method.toUpperCase())
          .join(', ');
        
        console.log(`${methods} ${basePath}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        const newBasePath = basePath + (layer.regexp.toString().indexOf('\\/(?=\\/|$)') >= 0 ? '' : layer.regexp.toString().replace(/\\|\^|\$|\?|\*|\+/g, '').replace('/(?=\\/|$)', ''));
        printRoutes(layer.handle.stack, newBasePath);
      }
    });
  };
  
  printRoutes(app._router.stack);
  console.log('========================\n');
}

// Chamar essa função antes de iniciar o servidor
printRegisteredRoutes(app);

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`[Server] Servidor unificado iniciado na porta ${PORT}`);
  console.log('[Server] Endpoints disponíveis:');
  console.log('- / (status do servidor)');
  console.log('- /api (rotas da API principal)');
  console.log('- /api/stream/roulettes (streaming SSE de dados de roletas)');
  console.log('- /emit-event (compatibilidade com WebSocket, se ativado)');
  console.log('[Server] Criptografia de API: ATIVADA');
  
  // Iniciar serviço de streaming de dados de roletas
  try {
    const rouletteDataService = require('./services/rouletteDataService');
    rouletteDataService.start()
      .then(() => console.log('[Server] Serviço de streaming de roletas iniciado'))
      .catch(err => console.error('[Server] Erro ao iniciar serviço de streaming:', err));
  } catch (err) {
    console.error('[Server] Erro ao carregar serviço de streaming:', err);
  }
});