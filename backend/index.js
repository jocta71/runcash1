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
const compression = require('compression');
const cookieParser = require('cookie-parser');
const socketIo = require('socket.io');
const { createProxyMiddleware } = require('http-proxy-middleware');
const setupCronJobs = require('./jobs/setupCronJobs');
const webhookRoutes = require('./api/routes/webhookRoutes');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const JWT_SECRET = process.env.JWT_SECRET || "runcash_jwt_secret_key_2023";

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

// FIREWALL CONDICIONAL NA RAIZ DO SERVIDOR: Bloqueio da rota /api/roulettes apenas para não-assinantes
// Este middleware é executado ANTES de qualquer outra configuração
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
    
    // Verificar se o usuário está autenticado
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Usuário não autenticado - bloquear acesso
      console.log(`[FIREWALL ROOT ${requestId}] 🛑 BLOQUEIO: Acesso não autenticado à rota ${path}`);
      console.log(`[FIREWALL ROOT ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
      console.log(`[FIREWALL ROOT ${requestId}] IP: ${req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
      console.log(`[FIREWALL ROOT ${requestId}] User-Agent: ${req.headers['user-agent']}`);
      console.log(`[FIREWALL ROOT ${requestId}] Timestamp: ${new Date().toISOString()}`);
      
      // Aplicar cabeçalhos CORS explicitamente
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      // Retornar resposta 401 Unauthorized
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para acessar este recurso.',
        code: 'AUTHENTICATION_REQUIRED',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Extrair token do cabeçalho
    const token = authHeader.split(' ')[1];
    
    try {
      // Verificar se o token é válido
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Definir informações do usuário na requisição
      req.usuario = decoded;
      
      // Verificar se o parâmetro customerId existe no token
      if (!decoded.customerId) {
        // Verificar se há customerId persistido no banco de dados
        console.log(`[FIREWALL ROOT ${requestId}] Token válido, mas sem customerId. Verificando no banco...`);
        
        try {
          // Conectar ao MongoDB
          const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
          await client.connect();
          const db = client.db();
          
          // Buscar usuário no banco
          const user = await db.collection('users').findOne({ id: decoded.id });
          
          if (user && user.customerId) {
            decoded.customerId = user.customerId;
            console.log(`[FIREWALL ROOT ${requestId}] CustomerId encontrado no banco: ${user.customerId}`);
          } else {
            // Usuário sem customerId - bloquear acesso
            console.log(`[FIREWALL ROOT ${requestId}] 🛑 BLOQUEIO: Usuário sem ID Asaas`);
            
            // Fechar conexão com MongoDB
            await client.close();
            
            return res.status(403).json({
              success: false,
              message: 'Assinatura necessária para acessar este recurso.',
              code: 'SUBSCRIPTION_REQUIRED',
              requestId: requestId,
              timestamp: new Date().toISOString()
            });
          }
          
          // Fechar conexão com MongoDB
          await client.close();
        } catch (dbError) {
          console.error(`[FIREWALL ROOT ${requestId}] Erro ao verificar banco de dados:`, dbError);
          
          return res.status(500).json({
            success: false,
            message: 'Erro interno ao verificar assinatura.',
            code: 'INTERNAL_ERROR',
            requestId: requestId,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Verificar assinatura Asaas
      if (decoded.customerId) {
        try {
          // Importar serviço Asaas
          const asaasService = require('./services/asaasService');
          
          // Verificar status da assinatura
          const subscriptionStatus = await asaasService.checkSubscriptionStatus(decoded.customerId);
          
          if (subscriptionStatus.hasActiveSubscription) {
            console.log(`[FIREWALL ROOT ${requestId}] ✓ Assinatura ativa verificada. Permitindo acesso.`);
            // Usuário com assinatura válida - permitir acesso
            return next();
          } else {
            // Usuário sem assinatura ativa - bloquear acesso
            console.log(`[FIREWALL ROOT ${requestId}] 🛑 BLOQUEIO: Sem assinatura ativa. Status: ${subscriptionStatus.status}`);
            
            return res.status(403).json({
              success: false,
              message: 'Assinatura ativa necessária para acessar este recurso.',
              code: 'ACTIVE_SUBSCRIPTION_REQUIRED',
              status: subscriptionStatus.status,
              requestId: requestId,
              timestamp: new Date().toISOString()
            });
          }
        } catch (asaasError) {
          console.error(`[FIREWALL ROOT ${requestId}] Erro ao verificar assinatura Asaas:`, asaasError);
          
          return res.status(500).json({
            success: false,
            message: 'Erro interno ao verificar assinatura.',
            code: 'ASAAS_SERVICE_ERROR',
            requestId: requestId,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Usuário sem customerId - bloquear acesso
        console.log(`[FIREWALL ROOT ${requestId}] 🛑 BLOQUEIO: Usuário sem ID Asaas após todas as verificações`);
        
        return res.status(403).json({
          success: false,
          message: 'Assinatura necessária para acessar este recurso.',
          code: 'SUBSCRIPTION_REQUIRED',
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (jwtError) {
      // Token inválido - bloquear acesso
      console.log(`[FIREWALL ROOT ${requestId}] 🛑 BLOQUEIO: Token JWT inválido`);
      console.log(`[FIREWALL ROOT ${requestId}] Erro: ${jwtError.message}`);
      
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação inválido ou expirado.',
        code: 'INVALID_TOKEN',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Se não for a rota específica, continuar para o próximo middleware
  next();
});

// Middlewares básicos
app.use(cors({
  origin: [
    'https://runcashh11.vercel.app',
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

// Configuração das rotas
// Rotas públicas
app.use('/api/auth', authRoutes);
app.use('/api/register', registerRoutes);
app.use('/webhooks', webhookRoutes);

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

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`[Server] Servidor unificado iniciado na porta ${PORT}`);
  console.log('[Server] Endpoints disponíveis:');
  console.log('- / (status do servidor)');
  console.log('- /api (rotas da API principal)');
  console.log('- /emit-event (compatibilidade com WebSocket, se ativado)');
  
  // Iniciar cron jobs
  setupCronJobs();
  console.log('Cron jobs iniciados');
});