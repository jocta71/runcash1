const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Adicionado para corrigir o problema de autenticação WebSocket

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = process.env.POLL_INTERVAL || 2000; // 2 segundos
const JWT_SECRET = process.env.JWT_SECRET || 'runcashh_secret_key'; // Definido globalmente para uso consistente

// Informações de configuração
console.log('==== Configuração do Servidor WebSocket ====');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log(`COLLECTION_NAME: ${COLLECTION_NAME}`);
console.log(`POLL_INTERVAL: ${POLL_INTERVAL}ms`);
console.log(`JWT_SECRET: ${JWT_SECRET ? '******' : 'Não definido'}`);

// Inicializar Express
const app = express();

// Middleware específico para bloquear APENAS a rota /api/roulettes
app.use((req, res, next) => {
  // Verificar se é exatamente a rota que queremos bloquear
  if (req.path === '/api/roulettes' || req.path === '/api/roulettes/') {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API ${requestId}] Tentativa de acesso à rota desativada /api/roulettes`);
    console.log(`[API ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[API ${requestId}] IP: ${req.ip || req.connection.remoteAddress}`);
    
    // Aplicar cabeçalhos CORS explicitamente para esta rota
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Retornar resposta indicando que a rota foi desativada
    return res.status(403).json({
      success: false,
      message: 'Esta rota foi desativada por motivos de segurança',
      code: 'ENDPOINT_DISABLED',
      requestId: requestId,
      alternativeEndpoints: [
        '/api/roletas',
        '/api/ROULETTES'
      ],
      timestamp: new Date().toISOString()
    });
  }
  
  next();
});

// Importar middlewares
const { verifyTokenAndSubscription, requireResourceAccess } = require('./middlewares/asaasAuthMiddleware');
const requestLogger = require('./middlewares/requestLogger');
const securityEnforcer = require('./middlewares/securityEnforcer');
const blockBrowserAccess = require('./middlewares/browserBlockMiddleware');
const apiProtectionShield = require('./middlewares/apiProtectionShield');
const { requireFormUrlEncoded, acceptJsonOrForm } = require('./middlewares/contentTypeMiddleware');
const { authenticateToken } = require('./middlewares/jwtAuthMiddleware');
const simpleAuthRoutes = require('./routes/simpleAuthRoutes');
const ultimateBlocker = require('./middlewares/ultimateBlocker');
const queryParamBlocker = require('./middlewares/queryParamBlocker');

// ========== NOVA IMPLEMENTAÇÃO - PROTEÇÃO ABSOLUTA ==========
// Aplicar os middlewares de proteção extrema como PRIMEIRA camada
// Isso deve ocorrer antes de qualquer outro middleware ou definição de rota
console.log('📢 Aplicando camadas de proteção extrema contra acesso direto aos endpoints de roleta');

// 1. Proteção específica contra parâmetros de consulta suspeitos 
app.use(queryParamBlocker());
console.log('✅ Proteção contra parâmetros de consulta suspeitos ativada');

// 2. Ultimate Blocker - Proteção absoluta contra acesso via navegador
app.use(ultimateBlocker());
console.log('✅ Proteção absoluta contra acesso via navegador ativada');

// Middlewares globais
app.use(express.json());
app.use(cors());
app.use(requestLogger()); // Middleware de log

// Aplicar proteção avançada (rate limiting, verificação de token, etc)
app.use(apiProtectionShield({
  ipRateLimit: 60,           // 60 requisições por minuto por IP
  tokenRateLimit: 120,       // 120 requisições por minuto por token
  userAgentRateLimit: 150,   // 150 requisições por minuto por User-Agent
  strictTokenTimeCheck: true // Verificação rigorosa do tempo do token
}));

// Aplicar bloqueio de acesso direto via navegador para todas as rotas de roleta
app.use(['/api/roulettes', '/api/ROULETTES', '/api/roletas'], blockBrowserAccess());

// Security enforcer para rotas protegidas
app.use(securityEnforcer());

// Configurar rotas de autenticação simplificada
app.use('/api/simple-auth', simpleAuthRoutes);
console.log('Rotas de autenticação simplificada configuradas em /api/simple-auth');

// Adicionar um endpoint de health check acessível sem autenticação
app.get('/api/health', (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[HEALTH ${requestId}] Verificação de saúde da API solicitada`);
  
  // Verificar origem da requisição
  const origin = req.headers.origin || req.headers.referer || 'desconhecida';
  console.log(`[HEALTH ${requestId}] Origem da requisição: ${origin}`);
  
  // Configurar CORS para esta requisição
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Retornar informações úteis para diagnóstico
  res.json({
    status: 'online',
    service: 'RunCash API',
    environment: process.env.NODE_ENV || 'production',
    server_time: new Date().toISOString(),
    request_id: requestId,
    endpoints: {
      authentication: '/api/simple-auth/login',
      protected: '/api/protected',
      admin: '/api/admin',
      roulettes: '/api/jwt-roulettes'
    },
    cors_enabled: true,
    headers_received: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      user_agent: req.headers['user-agent']
    }
  });
});

// Exemplo de rota protegida usando o novo middleware de autenticação JWT
app.get('/api/protected', 
  authenticateToken({ required: true }), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Você acessou um recurso protegido',
      user: req.user
    });
  }
);

// Exemplo de rota protegida com requisito de role
app.get('/api/admin', 
  authenticateToken({ required: true, roles: ['admin'] }), 
  (req, res) => {
    res.json({
      success: true,
      message: 'Bem-vindo, administrador!',
      user: req.user
    });
  }
);

// Função utilitária para configurar CORS de forma consistente
const configureCors = (req, res) => {
  // Sempre permitir todas as origens para simplificar
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // Cache por 24 horas
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Logar para depuração
  console.log(`[CORS] Configurado para requisição ${req.method} em ${req.path} de origem: ${req.headers.origin || 'desconhecida'}`);
  
  // Tratar solicitações preflight
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Requisição OPTIONS respondida automaticamente');
    return true; // Indica que a requisição OPTIONS foi tratada
  }
  
  return false; // Indica para continuar o processamento da requisição
};

// Configuração CORS aprimorada
app.use((req, res, next) => {
  // Usar a função utilitária de CORS
  const handled = configureCors(req, res);
  
  // Se a requisição já foi tratada (OPTIONS), encerrar aqui
  if (handled) {
    return res.status(204).end();
  }
  
  // Continuar para o próximo middleware
  next();
});

// Endpoint para testar CORS
app.get('/cors-test', (req, res) => {
  console.log(`[CORS] Teste CORS recebido de origem: ${req.headers.origin || 'desconhecida'}`);
  
  res.json({
    success: true,
    message: 'CORS está configurado corretamente!',
    origin: req.headers.origin || 'desconhecida',
    headers: {
      received: req.headers,
      sent: {
        'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers')
      }
    },
    timestamp: new Date().toISOString()
  });
});

// FIREWALL ABSOLUTO: Última linha de defesa para endpoints de roleta
app.use((req, res, next) => {
  // Obter caminho completo incluindo parâmetros de consulta
  const fullPath = req.originalUrl || req.url || req.path;
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Verificar se é especificamente a rota /api/roulettes (desativada)
  if (fullPath === '/api/roulettes') {
    console.log(`[FIREWALL ${requestId}] Bloqueando acesso à rota desativada /api/roulettes`);
    console.log(`[FIREWALL ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[FIREWALL ${requestId}] IP: ${req.ip || req.connection.remoteAddress}`);
    
    // Aplicar cabeçalhos CORS explicitamente para esta rota
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Retornar resposta indicando que a rota foi desativada
    return res.status(403).json({
      success: false,
      message: 'Esta rota foi desativada por motivos de segurança',
      code: 'ENDPOINT_DISABLED',
      requestId: requestId,
      alternativeEndpoints: [
        '/api/roletas',
        '/api/ROULETTES'
      ],
      timestamp: new Date().toISOString()
    });
  }
  
  // Verificar TODAS as possíveis variações de endpoints de roleta, incluindo parâmetros de consulta
  const isRouletteRequest = (
    fullPath.includes('/api/ROULETTES') || 
    fullPath.includes('/api/roletas') ||
    /\/api\/ROULETTES.*/.test(fullPath) ||
    /\/api\/roletas.*/.test(fullPath) ||
    // Verificação especial para parâmetros _I, _t e qualquer outro
    fullPath.match(/\/api\/.*_[It]=/) ||
    // Verificação para variações numéricas
    fullPath.match(/\/api\/.*roulettes\d+/) ||
    fullPath.match(/\/api\/.*ROULETTES\d+/) ||
    fullPath.match(/\/api\/.*roletas\d+/)
  );
  
  // Se não for endpoint de roleta, deixar passar
  if (!isRouletteRequest) {
    return next();
  }
  
  // Verificar se há token de autorização
  const hasAuth = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  if (!hasAuth) {
    console.log(`[FIREWALL ${requestId}] BLOQUEIO FINAL: Requisição sem token para endpoint de roleta`);
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Autenticação obrigatória',
      code: 'FIREWALL_BLOCK',
      path: fullPath,
      requestId: requestId
    });
  }
  
  // Se chegou até aqui, continuar para o próximo middleware
  next();
});

app.use(express.json());

// Add a status endpoint to check if the server is working
app.get('/socket-status', (req, res) => {
  res.json({
    status: 'online',
    mongoConnected: isConnected,
    timestamp: new Date().toISOString()
  });
});

// Adicionar rota para a raiz - necessária para health checks do Railway
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash WebSocket Server',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para receber eventos do scraper Python
app.post('/emit-event', (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (!event || !data) {
      return res.status(400).json({ error: 'Evento ou dados ausentes no payload' });
    }
    
    console.log(`[WebSocket] Recebido evento ${event} do scraper`);
    
    // Broadcast do evento para todos os clientes conectados
    io.emit(event, data);
    
    res.status(200).json({ success: true, message: 'Evento emitido com sucesso' });
  } catch (error) {
    console.error('[WebSocket] Erro ao processar evento do scraper:', error);
    res.status(500).json({ error: 'Erro interno ao processar evento' });
  }
});

// Criar servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.IO com configurações CORS aprimoradas
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowEIO3: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // Aumentar timeout para 60s
  pingInterval: 25000, // Verificar conexão a cada 25s
  connectTimeout: 45000 // Aumentar tempo limite de conexão
});

// Verificar se o middleware de autenticação está sendo registrado corretamente
console.log('[Socket.IO] Registrando middleware de autenticação JWT...');

// Adicionar middleware de autenticação global para todas as conexões Socket.io
io.use((socket, next) => {
  try {
    const token = socket.handshake.query.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log(`[WebSocket Middleware] Conexão rejeitada: ${socket.id} - Token ausente`);
      return next(new Error('Autenticação necessária. Token não fornecido.'));
    }
    
    // Verificar JWT com a constante global JWT_SECRET
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Guardar dados do usuário no socket
    socket.user = decoded;
    socket.isAuthenticated = true;
    
    console.log(`[WebSocket Middleware] Conexão autorizada: ${socket.id} - Usuário: ${decoded.username || decoded.email || decoded.id || 'usuário'}`);
    return next();
  } catch (error) {
    console.log(`[WebSocket Middleware] Conexão rejeitada: ${socket.id} - Erro: ${error.message}`);
    return next(new Error('Token inválido ou expirado. Por favor, autentique-se novamente.'));
  }
});

console.log('[Socket.IO] Middleware de autenticação JWT registrado com sucesso');
console.log('[Socket.IO] Inicializado com configuração CORS para aceitar todas as origens');

// Status e números das roletas
let rouletteStatus = {};
let lastProcessedIds = new Set();

// Conectar ao MongoDB
let db, collection;
let isConnected = false;

// Importar serviços necessários
const mongodb = require('./api/libs/mongodb');
const RouletteHistory = require('./api/models/RouletteHistory');

// Inicializar o modelo de histórico quando MongoDB estiver conectado
let historyModel = null;

// Conectar ao MongoDB e inicializar modelos
async function initializeModels() {
  try {
    if (!mongodb.isConnected()) {
      await mongodb.connect();
    }
    
    if (!historyModel && mongodb.getDb()) {
      historyModel = new RouletteHistory(mongodb.getDb());
      console.log('Modelo de histórico inicializado com sucesso');
    }
  } catch (error) {
    console.error('Erro ao inicializar modelos:', error);
  }
}

// Função para conectar ao MongoDB
async function connectToMongoDB() {
  try {
    console.log('Attempting to connect to MongoDB at:', MONGODB_URI);
    
    const client = new MongoClient(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    // Usar explicitamente o banco de dados 'runcash'
    db = client.db('runcash');
    collection = db.collection(COLLECTION_NAME);
    isConnected = true;
    
    // Log database info
    const dbName = db.databaseName;
    const collections = await db.listCollections().toArray();
    console.log(`Database name: ${dbName}`);
    console.log('Available collections:', collections.map(c => c.name).join(', '));
    
    // Verificar se há dados na coleção
    const count = await collection.countDocuments();
    console.log(`Número de documentos na coleção ${COLLECTION_NAME}: ${count}`);
    
    if (count > 0) {
      // Mostrar alguns exemplos de documentos
      const samples = await collection.find().limit(3).toArray();
      console.log('Exemplos de documentos:');
      console.log(JSON.stringify(samples, null, 2));
    }
    
    // Iniciar o polling para verificar novos dados
    startPolling();
    
    // Broadcast dos estados de estratégia atualizados
    setTimeout(broadcastAllStrategies, 2000);
    
    // Conectar ao MongoDB e inicializar modelos
    await initializeModels();
    
    return true;
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    isConnected = false;
    return false;
  }
}

// Função para enviar estados de estratégia atualizados para todas as roletas
async function broadcastAllStrategies() {
  if (!db) return;
  
  try {
    console.log('Enviando estados de estratégia atualizados para todas as roletas...');
    
    // Buscar todas as estratégias mais recentes de cada roleta
    const estrategias = await db.collection('estrategia_historico_novo').find().toArray();
    
    // Agrupar estratégias por roleta (pegando a mais recente)
    const estrategiasPorRoleta = {};
    
    estrategias.forEach(strategy => {
      const roleta_id = strategy.roleta_id;
      const roleta_nome = strategy.roleta_nome;
      
      if (!estrategiasPorRoleta[roleta_id] || 
          new Date(strategy.timestamp) > new Date(estrategiasPorRoleta[roleta_id].timestamp)) {
        estrategiasPorRoleta[roleta_id] = strategy;
      }
    });
    
    // Enviar cada estratégia como evento
    for (const roleta_id in estrategiasPorRoleta) {
      const strategy = estrategiasPorRoleta[roleta_id];
      const roleta_nome = strategy.roleta_nome;
      
      // Adicionar debug para mostrar detalhes da estratégia
      console.log('\n=== DETALHES DA ESTRATÉGIA ===');
      console.log(`Roleta: ${roleta_nome} (ID: ${roleta_id})`);
      console.log(`Estado: ${strategy.estado || 'Nenhum'}`);
      console.log(`Número gatilho: ${strategy.numero_gatilho}`);
      console.log(`Terminais: ${JSON.stringify(strategy.terminais_gatilho)}`);
      console.log(`Sugestão display: ${strategy.sugestao_display || 'Nenhuma'}`);
      console.log('===========================\n');
      
      const strategyEvent = {
        type: 'strategy_update',
        roleta_id,
        roleta_nome: roleta_nome,
        estado: strategy.estado,
        numero_gatilho: strategy.numero_gatilho || 0,
        terminais_gatilho: strategy.terminais_gatilho || [],
        vitorias: strategy.vitorias || 0,
        derrotas: strategy.derrotas || 0,
        sugestao_display: strategy.sugestao_display || ''
      };
      
      // Log detalhado do evento que será enviado
      console.log(`Enviando evento detalhado: ${JSON.stringify(strategyEvent)}`);
      
      io.to(roleta_nome).emit('strategy_update', strategyEvent);
      io.emit('global_strategy_update', strategyEvent);
      
      console.log(`Enviado evento de estratégia para roleta ${roleta_nome}: estado ${strategy.estado}`);
    }
    
    console.log(`Enviados eventos de estratégia para ${Object.keys(estrategiasPorRoleta).length} roletas`);
  } catch (error) {
    console.error('Erro ao enviar estados de estratégia:', error);
  }
}

// Função para fazer polling dos dados mais recentes
function startPolling() {
  console.log('Iniciando polling a cada ' + POLL_INTERVAL + 'ms');
  
  // Configurar intervalo para buscar dados regularmente
  pollingInterval = setInterval(async () => {
    try {
      console.log('Conectando ao MongoDB...');
      
      if (!isConnected || !collection) {
        console.log('MongoDB não está conectado, tentando reconectar...');
        await connectToMongoDB();
        return;
      }
      
      // Buscar a contagem total de documentos para diagnóstico
      const totalCount = await collection.countDocuments();
      console.log(`Total de documentos na coleção: ${totalCount}`);
      
      // Buscar os números mais recentes para cada roleta
      const results = await collection.aggregate([
        { $sort: { timestamp: -1 } },
        { $group: { 
            _id: '$roleta_nome', 
            roleta_id: { $first: '$roleta_id' }, 
            numero: { $first: '$numero' }, 
            cor: { $first: '$cor' },
            timestamp: { $first: '$timestamp' }
          }
        }
      ]).toArray();
      
      if (results.length === 0) {
        console.log('Nenhum número encontrado na coleção');
        return;
      }
      
      console.log(`Encontrados últimos números para ${results.length} roletas`);
      
      // Enviar eventos para cada roleta
      results.forEach(result => {
        if (io) {
          const eventData = {
            roleta_id: result.roleta_id,
            roleta_nome: result._id,
            numero: result.numero,
            cor: result.cor,
            timestamp: result.timestamp
          };
          
          // Emitir evento para o namespace da roleta
          const namespace = `roleta_${result.roleta_id}`;
          io.to(namespace).emit('numero', eventData);
          
          // Também emitir para o canal geral
          io.emit('numero', eventData);
          
          console.log(`Enviado evento para roleta ${result._id}: número ${result.numero}`);
        }
      });
    } catch (error) {
      console.error('Erro durante polling:', error);
    }
  }, POLL_INTERVAL);
}

// Rota de status da API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mongodb_connected: isConnected,
    version: '1.0.0'
  });
});

// Rota para listar todas as roletas (endpoint em inglês)
app.get('/api/roulettes', (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API ${requestId}] Tentativa de acesso à rota desativada /api/roulettes`);
    console.log(`[API ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[API ${requestId}] IP: ${req.ip || req.connection.remoteAddress}`);
    
    // Aplicar cabeçalhos CORS explicitamente para esta rota
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Retornar resposta indicando que a rota foi desativada
    return res.status(403).json({
      success: false,
      message: 'Esta rota foi desativada por motivos de segurança',
      code: 'ENDPOINT_DISABLED',
      requestId: requestId,
      alternativeEndpoints: [
        '/api/roletas',
        '/api/ROULETTES'
      ],
      timestamp: new Date().toISOString()
    });
});

// Rota para listar todas as roletas (endpoint em maiúsculas para compatibilidade)
app.get('/api/ROULETTES',
  (req, res, next) => {
    // VALIDAÇÃO EXTREMA: Verificar token JWT antes de qualquer coisa
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[ULTRA-SECURE ${requestId}] Validação bruta no próprio endpoint /api/ROULETTES`);
    
    // Verificar se há token de autorização
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Sem token de autorização válido`);
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - Token de autenticação obrigatório',
        code: 'ENDPOINT_LEVEL_BLOCK',
        requestId
      });
    }
    
    // Extrair e verificar o token JWT diretamente
    try {
      const token = authHeader.slice(7); // Remove 'Bearer '
      // Usar a constante global JWT_SECRET em vez de definir localmente
      
      // Verificar token - isto lança erro se inválido
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (!decoded || !decoded.id) {
        console.log(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Token JWT inválido ou malformado`);
        return res.status(401).json({
          success: false,
          message: 'Acesso negado - Token de autenticação inválido',
          code: 'ENDPOINT_LEVEL_BLOCK',
          requestId
        });
      }
      
      console.log(`[ULTRA-SECURE ${requestId}] ✓ Token JWT validado para usuário ${decoded.id}`);
      next();
    } catch (error) {
      console.error(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Erro na validação JWT:`, error.message);
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - Token de autenticação inválido ou expirado',
        code: 'ENDPOINT_LEVEL_JWT_ERROR',
        requestId
      });
    }
  },
  verifyTokenAndSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
  }),
  async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API ${requestId}] Requisição processada diretamente em /api/ROULETTES`);
    console.log(`[API ${requestId}] Usuário: ${req.usuario?.id}`);
    console.log(`[API ${requestId}] Plano: ${req.userPlan?.type}`);
    console.log(`[API ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[API ${requestId}] Query params: ${JSON.stringify(req.query)}`);
    
    // VERIFICAÇÃO DUPLA: Se o middleware falhar, verificar novamente aqui
    if (!req.usuario || !req.subscription) {
      console.log(`[API ${requestId}] BLOQUEIO SECUNDÁRIO: Acesso não autenticado ou sem assinatura detectado`);
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - Autenticação e assinatura são obrigatórias',
        code: 'DOUBLE_VERIFICATION_FAILED',
        requestId: requestId
      });
    }
    
    // VERIFICAÇÃO TRIPLA: Verificar se a assinatura é válida
    try {
      // Verificar data de validade da assinatura
      const validUntil = req.subscription.validade || req.subscription.expiresAt || req.subscription.nextDueDate;
      if (validUntil && new Date(validUntil) < new Date()) {
        console.log(`[API ${requestId}] BLOQUEIO TERCIÁRIO: Assinatura expirada`);
        return res.status(403).json({
          success: false,
          message: 'Sua assinatura expirou. Por favor, renove para continuar acessando este recurso.',
          code: 'SUBSCRIPTION_EXPIRED',
          requestId: requestId,
          expiryDate: validUntil
        });
      }
    } catch (error) {
      console.error(`[API ${requestId}] Erro ao verificar data de validade da assinatura:`, error);
    }
    
    // Aplicar cabeçalhos CORS explicitamente para esta rota
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    try {
      // Em vez de redirecionar, processamos a requisição aqui diretamente
      if (!isConnected || !collection) {
        console.log(`[API ${requestId}] MongoDB não conectado, retornando array vazio`);
        return res.json([]);
      }
      
      // Log de acesso bem-sucedido
      console.log(`[API ${requestId}] ACESSO PERMITIDO: Usuário autenticado com assinatura válida`);
      
      // Obter roletas únicas da coleção - código idêntico ao endpoint /api/roulettes
      const roulettes = await collection.aggregate([
        { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
        { $project: { _id: 0, id: 1, nome: "$_id" } }
      ]).toArray();
      
      console.log(`[API ${requestId}] Processadas ${roulettes.length} roletas para usuário ${req.usuario?.id} com plano ${req.userPlan?.type}`);
      
      // Retornar diretamente os dados, sem redirecionamento
      return res.json(roulettes);
    } catch (error) {
      console.error(`[API ${requestId}] Erro ao listar roletas (endpoint maiúsculas):`, error);
      return res.status(500).json({ 
        error: 'Erro interno ao buscar roletas',
        message: error.message,
        requestId: requestId
      });
    }
});

// Rota para listar todas as roletas (endpoint em português - compatibilidade)
app.get('/api/roletas', 
  verifyTokenAndSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
  }), 
  async (req, res) => {
    console.log('[API] Endpoint de compatibilidade /api/roletas acessado');
    try {
      if (!isConnected) {
        return res.status(503).json({ error: 'Serviço indisponível: sem conexão com MongoDB' });
      }
      
      // Obter roletas únicas da coleção
      const roulettes = await collection.aggregate([
        { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
        { $project: { _id: 0, id: 1, nome: "$_id" } }
      ]).toArray();
      
      res.json(roulettes);
    } catch (error) {
      console.error('Erro ao listar roletas:', error);
      res.status(500).json({ error: 'Erro interno ao buscar roletas' });
    }
});

// Rota para buscar números por nome da roleta
app.get('/api/numbers/:roletaNome', 
  (req, res, next) => {
    // VALIDAÇÃO EXTREMA: Verificar token JWT antes de qualquer coisa
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[ULTRA-SECURE ${requestId}] Validação bruta no endpoint /api/numbers/:roletaNome`);
    
    // Verificar se há token de autorização
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Sem token de autorização válido`);
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - Token de autenticação obrigatório',
        code: 'ENDPOINT_LEVEL_BLOCK',
        requestId
      });
    }
    
    // Extrair e verificar o token JWT diretamente
    try {
      const token = authHeader.slice(7); // Remove 'Bearer '
      // Usar a constante global JWT_SECRET
      
      // Verificar token - isto lança erro se inválido
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (!decoded || !decoded.id) {
        console.log(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Token JWT inválido ou malformado`);
        return res.status(401).json({
          success: false,
          message: 'Acesso negado - Token de autenticação inválido',
          code: 'ENDPOINT_LEVEL_BLOCK',
          requestId
        });
      }
      
      console.log(`[ULTRA-SECURE ${requestId}] ✓ Token JWT validado para usuário ${decoded.id}`);
      next();
    } catch (error) {
      console.error(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Erro na validação JWT:`, error.message);
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - Token de autenticação inválido ou expirado',
        code: 'ENDPOINT_LEVEL_JWT_ERROR',
        requestId
      });
    }
  },
  verifyTokenAndSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
  }), 
  async (req, res) => {
    try {
      if (!isConnected) {
        return res.status(503).json({ error: 'Serviço indisponível: sem conexão com MongoDB' });
      }
      
      const roletaNome = req.params.roletaNome;
      const limit = parseInt(req.query.limit) || 20;
      
      // Buscar números da roleta especificada
      const numbers = await collection
        .find({ roleta_nome: roletaNome })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      res.json(numbers);
    } catch (error) {
      console.error('Erro ao buscar números da roleta:', error);
      res.status(500).json({ error: 'Erro interno ao buscar números' });
    }
});

// Rota para buscar números por ID da roleta
app.get('/api/numbers/byid/:roletaId', 
  (req, res, next) => {
    // VALIDAÇÃO EXTREMA: Verificar token JWT antes de qualquer coisa
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[ULTRA-SECURE ${requestId}] Validação bruta no endpoint /api/numbers/byid/:roletaId`);
    
    // Verificar se há token de autorização
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Sem token de autorização válido`);
    return res.status(401).json({
      success: false,
        message: 'Acesso negado - Token de autenticação obrigatório',
        code: 'ENDPOINT_LEVEL_BLOCK',
      requestId
    });
  }
  
    // Extrair e verificar o token JWT diretamente
  try {
    const token = authHeader.slice(7); // Remove 'Bearer '
      // Usar a constante global JWT_SECRET
    
      // Verificar token - isto lança erro se inválido
      const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded || !decoded.id) {
        console.log(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Token JWT inválido ou malformado`);
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - Token de autenticação inválido',
          code: 'ENDPOINT_LEVEL_BLOCK',
        requestId
      });
    }
    
      console.log(`[ULTRA-SECURE ${requestId}] ✓ Token JWT validado para usuário ${decoded.id}`);
    next();
  } catch (error) {
      console.error(`[ULTRA-SECURE ${requestId}] ⛔ BLOQUEIO ABSOLUTO: Erro na validação JWT:`, error.message);
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Token de autenticação inválido ou expirado',
        code: 'ENDPOINT_LEVEL_JWT_ERROR',
          requestId
        });
    }
  },
  verifyTokenAndSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
  }), 
  async (req, res) => {
    try {
      if (!isConnected) {
        return res.status(503).json({ error: 'Serviço indisponível: sem conexão com MongoDB' });
      }
      
      const roletaId = req.params.roletaId;
      const limit = parseInt(req.query.limit) || 20;
      
      // Buscar números da roleta especificada
      const numbers = await collection
        .find({ roleta_id: roletaId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
      
      res.json(numbers);
    } catch (error) {
      console.error('Erro ao buscar números da roleta:', error);
      console.error(`[API-JWT ${requestId}] Erro ao listar roletas:`, error);
      res.status(500).json({ 
        success: false,
        error: 'Erro interno ao buscar roletas',
        message: error.message,
        requestId: requestId 
      });
    }
  }
);
