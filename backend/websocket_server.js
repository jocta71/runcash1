const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = process.env.POLL_INTERVAL || 2000; // 2 segundos

// Informações de configuração
console.log('==== Configuração do Servidor WebSocket ====');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log(`COLLECTION_NAME: ${COLLECTION_NAME}`);
console.log(`POLL_INTERVAL: ${POLL_INTERVAL}ms`);

// Inicializar Express
const app = express();

// Middleware para bloquear ABSOLUTAMENTE TODAS as requisições a endpoints de roleta sem autenticação válida
// Este middleware é executado ANTES de qualquer outro para garantir que requisições sem autenticação
// nem sequer cheguem aos middlewares específicos
app.use((req, res, next) => {
  // Obter caminho da requisição
  const path = req.originalUrl || req.url || req.path;
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Verificar se é um endpoint de roleta (qualquer variação possível)
  const isRouletteEndpoint = (
    path.includes('/api/roulettes') || 
    path.includes('/api/ROULETTES') || 
    path.includes('/api/roletas') ||
    /\/api\/roulettes.*/.test(path) ||
    /\/api\/ROULETTES.*/.test(path) ||
    /\/api\/roletas.*/.test(path)
  );
  
  // Se não for endpoint de roleta, ou se for uma requisição OPTIONS, deixar passar
  if (!isRouletteEndpoint || req.method === 'OPTIONS') {
    return next();
  }
  
  // Registrar a interceptação
  console.log(`[BLOQUEIO-GLOBAL ${requestId}] Interceptada requisição para endpoint de roleta: ${path}`);
  console.log(`[BLOQUEIO-GLOBAL ${requestId}] Método: ${req.method}`);
  console.log(`[BLOQUEIO-GLOBAL ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
  
  // Verificar se há token de autorização
  const hasAuth = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  if (!hasAuth) {
    console.log(`[BLOQUEIO-GLOBAL ${requestId}] BLOQUEIO ABSOLUTO: Requisição sem token para endpoint de roleta`);
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Autenticação obrigatória',
      code: 'GLOBAL_ABSOLUTE_BLOCK',
      path: path,
      requestId: requestId
    });
  }
  
  // Se tiver autorização, deixar passar para o middleware de verificação completa
  console.log(`[BLOQUEIO-GLOBAL ${requestId}] Requisição com authorization header, continuando para verificação completa`);
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
// Esta função verifica E BLOQUEIA absolutamente QUALQUER tentativa não autenticada de acessar endpoints de roleta
// Ela é deliberadamente redundante como medida de segurança extra
app.use((req, res, next) => {
  // Obter caminho completo incluindo parâmetros de consulta
  const fullPath = req.originalUrl || req.url || req.path;
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Verificar TODAS as possíveis variações de endpoints de roleta, incluindo parâmetros de consulta
  const isRouletteRequest = (
    fullPath.includes('/api/roulettes') || 
    fullPath.includes('/api/ROULETTES') || 
    fullPath.includes('/api/roletas') ||
    /\/api\/roulettes.*/.test(fullPath) ||
    /\/api\/ROULETTES.*/.test(fullPath) ||
    /\/api\/roletas.*/.test(fullPath) ||
    // Verificação especial para parâmetros _I, _t e qualquer outro
    fullPath.match(/\/api\/.*_[It]=/) ||
    // Verificação para variações numéricas
    fullPath.match(/\/api\/.*roulettes\d+/) ||
    fullPath.match(/\/api\/.*ROULETTES\d+/) ||
    fullPath.match(/\/api\/.*roletas\d+/)
  );
  
  // Se não for endpoint de roleta ou for OPTIONS, permitir
  if (!isRouletteRequest || req.method === 'OPTIONS') {
    return next();
  }
  
  // Verificar autenticação (requisição deve ter o cabeçalho Authorization e estar autenticada)
  const hasAuthHeader = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  const isAuthenticated = req.hasOwnProperty('usuario') && req.hasOwnProperty('subscription') && req.subscription;
  
  // Se não houver cabeçalho de autorização ou não estiver autenticado, bloquear IMEDIATAMENTE
  if (!hasAuthHeader || !isAuthenticated) {
    console.log(`[FIREWALL ${requestId}] 🚫 BLOQUEIO ABSOLUTO: Endpoint protegido sem autenticação adequada: ${fullPath}`);
    console.log(`[FIREWALL ${requestId}] Método: ${req.method}`);
    console.log(`[FIREWALL ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[FIREWALL ${requestId}] Tem header Auth: ${hasAuthHeader}, Está autenticado: ${isAuthenticated}`);
    
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Autenticação completa obrigatória',
      code: 'ABSOLUTE_FIREWALL',
      path: fullPath,
      requestId: requestId
    });
  }
  
  // Verificação final de segurança
  if (!req.subscription) {
    console.log(`[FIREWALL ${requestId}] 🚫 BLOQUEIO ABSOLUTO: Acesso sem assinatura verificada: ${fullPath}`);
    return res.status(403).json({
      success: false,
      message: 'Acesso negado - Assinatura ativa obrigatória',
      code: 'ABSOLUTE_FIREWALL',
      path: fullPath,
      requestId: requestId
    });
  }
  
  // Se passou por todas as verificações, continuar
  console.log(`[FIREWALL ${requestId}] ✅ Permitido: Acesso autenticado com assinatura válida: ${fullPath}`);
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
app.get('/api/roulettes', 
  (req, res, next) => {
    // VALIDAÇÃO EXTREMA: Verificar token JWT antes de qualquer coisa
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[ULTRA-SECURE ${requestId}] Validação bruta no próprio endpoint /api/roulettes`);
    
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
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
      
      // Verificar token - isto lança erro se inválido
      const decoded = jwt.verify(token, secret);
      
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
    console.log(`[API ${requestId}] Requisição recebida para /api/roulettes`);
    console.log(`[API ${requestId}] Usuário: ${req.usuario?.id}`);
    console.log(`[API ${requestId}] Plano: ${req.userPlan?.type}`);
    console.log(`[API ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[API ${requestId}] Query: ${JSON.stringify(req.query)}`);
    
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
      if (!isConnected || !collection) {
        console.log(`[API ${requestId}] MongoDB não conectado, retornando array vazio`);
        return res.json([]);
      }
      
      // Log de acesso bem-sucedido
      console.log(`[API ${requestId}] ACESSO PERMITIDO: Usuário autenticado com assinatura válida`);
      
      // Obter roletas únicas da coleção
      const roulettes = await collection.aggregate([
        { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
        { $project: { _id: 0, id: 1, nome: "$_id" } }
      ]).toArray();
      
      console.log(`[API ${requestId}] Processadas ${roulettes.length} roletas para usuário ${req.usuario?.id} com plano ${req.userPlan?.type}`);
      res.json(roulettes);
    } catch (error) {
      console.error(`[API ${requestId}] Erro ao listar roletas:`, error);
      res.status(500).json({ 
        error: 'Erro interno ao buscar roletas',
        message: error.message,
        requestId: requestId 
      });
    }
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
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
      
      // Verificar token - isto lança erro se inválido
      const decoded = jwt.verify(token, secret);
      
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
      res.status(500).json({ error: 'Erro interno ao buscar números' });
    }
});

// Endpoint de compatibilidade para obter detalhes de uma roleta por ID
app.get('/api/roletas/:id', 
  verifyTokenAndSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
  }), 
  async (req, res) => {
    console.log('[API] Endpoint de compatibilidade /api/roletas/:id acessado');
    try {
      if (!isConnected) {
        return res.status(503).json({ error: 'Serviço indisponível: sem conexão com MongoDB' });
      }
      
      const roletaId = req.params.id;
      
      // Buscar informações da roleta especificada
      const roleta = await db.collection('roletas').findOne({ id: roletaId });
      
      if (!roleta) {
        return res.status(404).json({ error: 'Roleta não encontrada' });
      }
      
      res.json(roleta);
    } catch (error) {
      console.error('Erro ao buscar detalhes da roleta:', error);
      res.status(500).json({ error: 'Erro interno ao buscar detalhes da roleta' });
    }
});

// Rota para inserir número (para testes)
app.post('/api/numbers', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({ error: 'Serviço indisponível: sem conexão com MongoDB' });
    }
    
    const { roleta_nome, roleta_id, numero } = req.body;
    
    if (!roleta_nome || !numero) {
      return res.status(400).json({ error: 'Campos obrigatórios: roleta_nome, numero' });
    }
    
    // Determinar a cor do número
    let cor = 'verde';
    if (numero > 0) {
      const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      cor = numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
    }
    
    // Inserir novo número
    const result = await collection.insertOne({
      roleta_nome, 
      roleta_id: roleta_id || 'unknown',
      numero: parseInt(numero),
      cor,
      timestamp: new Date().toISOString()
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Número inserido com sucesso',
      id: result.insertedId
    });
  } catch (error) {
    console.error('Erro ao inserir número:', error);
    res.status(500).json({ error: 'Erro interno ao inserir número' });
  }
});

// Rota para buscar número específico por ID
app.get('/api/numbers/:id', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({ error: 'Serviço indisponível: sem conexão com MongoDB' });
    }
    
    const id = req.params.id;
    console.log(`Buscando número com ID: ${id}`);
    
    // Verificar formato do ID
    let numeroDoc;
    try {
      // Tentar buscar por ID do MongoDB (ObjectId)
      const ObjectId = require('mongodb').ObjectId;
      if (ObjectId.isValid(id)) {
        numeroDoc = await collection.findOne({ _id: new ObjectId(id) });
      }
    } catch (err) {
      console.log(`Não foi possível buscar como ObjectId: ${err.message}`);
    }
    
    // Se não encontrou por ObjectId, tentar buscar por campo personalizado
    if (!numeroDoc) {
      numeroDoc = await collection.findOne({ 
        $or: [
          { roleta_id: id },
          { numero: parseInt(id, 10) }
        ]
      });
    }
    
    if (!numeroDoc) {
      console.log(`Número não encontrado com ID: ${id}`);
      return res.status(404).json({ error: 'Número não encontrado' });
    }
    
    res.json(numeroDoc);
  } catch (error) {
    console.error(`Erro ao buscar número com ID ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro interno ao buscar número' });
  }
});

// Rota para listar todos os números
app.get('/api/numbers', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({ error: 'Serviço indisponível: sem conexão com MongoDB' });
    }
    
    // Parâmetros opcionais de paginação
    const limit = parseInt(req.query.limit) || 100;  // Aumentado para retornar mais registros
    const skip = parseInt(req.query.skip) || 0;
    
    // Filtros opcionais
    const filtros = {};
    if (req.query.roleta_id) filtros.roleta_id = req.query.roleta_id;
    if (req.query.roleta_nome) filtros.roleta_nome = req.query.roleta_nome;
    if (req.query.numero) filtros.numero = parseInt(req.query.numero);
    if (req.query.cor) filtros.cor = req.query.cor;
    
    // Buscar números com filtros e paginação
    const numeros = await collection.find(filtros)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Contar total de documentos que correspondem aos filtros
    const total = await collection.countDocuments(filtros);
    
    res.json({
      total,
      skip,
      limit,
      data: numeros
    });
  } catch (error) {
    console.error('Erro ao listar números:', error);
    res.status(500).json({ error: 'Erro interno ao listar números' });
  }
});

// Endpoint para forçar retorno com cabeçalho CORS para qualquer origem
app.get('/disable-cors-check', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  
  res.json({
    message: 'Este endpoint tem CORS completamente desativado para diagnóstico',
    timestamp: new Date().toISOString(),
    cors: 'disabled',
    origin: req.headers.origin || 'unknown'
  });
});

// Endpoint específico para buscar histórico completo
app.get('/api/historico', async (req, res) => {
  console.log('[API] Requisição recebida para /api/historico');
  console.log('[API] Query params:', req.query);
  
  try {
    if (!isConnected || !collection) {
      console.log('[API] MongoDB não conectado, retornando array vazio');
      return res.json({ data: [], total: 0 });
    }
    
    // Parâmetros de consulta
    const limit = parseInt(req.query.limit) || 2000;  // Aumentado para retornar mais registros
    const skip = parseInt(req.query.skip) || 0;
    
    // Filtros opcionais
    const filtros = {};
    if (req.query.roleta_id) filtros.roleta_id = req.query.roleta_id;
    if (req.query.roleta_nome) filtros.roleta_nome = req.query.roleta_nome;
    
    console.log(`[API] Buscando histórico com filtros:`, filtros);
    console.log(`[API] Limit: ${limit}, Skip: ${skip}`);
    
    // Buscar dados com paginação
    const numeros = await collection
      .find(filtros)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Contar total de documentos
    const total = await collection.countDocuments(filtros);
    
    console.log(`[API] Retornando ${numeros.length} registros de um total de ${total}`);
    
    res.json({
      data: numeros,
      total,
      limit,
      skip
    });
  } catch (error) {
    console.error('[API] Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno ao buscar histórico' });
  }
});

// Rota específica para o histórico
app.get('/api/ROULETTES/historico', 
  verifyTokenAndSubscription({ 
    required: true, 
    allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
  }),
  async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API ${requestId}] Requisição recebida para /api/ROULETTES/historico`);
    console.log(`[API ${requestId}] Usuário: ${req.usuario?.id}`);
    console.log(`[API ${requestId}] Plano: ${req.userPlan?.type}`);
    console.log(`[API ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[API ${requestId}] Query: ${JSON.stringify(req.query)}`);
    
    // Verificação dupla de assinatura válida
    if (!req.subscription) {
      console.log(`[API ${requestId}] Bloqueando acesso - assinatura não encontrada`);
      return res.status(403).json({
        success: false,
        message: 'Você precisa de uma assinatura ativa para acessar este recurso',
        code: 'SUBSCRIPTION_REQUIRED',
        requestId: requestId
      });
    }
    
    // Configurar CORS explicitamente para esta rota
    configureCors(req, res);
    
    // Responder com o histórico
    try {
      if (!isConnected || !collection) {
        console.log(`[API ${requestId}] MongoDB não conectado, retornando array vazio`);
        return res.json([]);
      }
      
      // Obter histórico de números jogados
      const historico = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(2000)  // Aumentado para retornar mais registros
        .toArray();
      
      if (historico.length > 0) {
        console.log(`[API ${requestId}] Retornando histórico com ${historico.length} entradas para usuário ${req.usuario?.id}`);
        res.json(historico);
      } else {
        console.log(`[API ${requestId}] Histórico vazio`);
        res.status(404).json({ 
          error: 'Histórico vazio',
          requestId: requestId
        });
      }
    } catch (error) {
      console.error(`[API ${requestId}] Erro ao buscar histórico:`, error);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message,
        requestId: requestId 
      });
    }
});

// Manipulador OPTIONS específico para /api/ROULETTES
app.options('/api/ROULETTES', (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[CORS ${requestId}] Requisição OPTIONS recebida para /api/ROULETTES`);
  
  // Aplicar cabeçalhos CORS necessários
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // Cache por 24 horas
  
  // Responder imediatamente com sucesso
  console.log(`[CORS ${requestId}] Resposta OPTIONS enviada com status 204`);
  res.status(204).end();
});

// Manipulador OPTIONS específico para /api/ROULETTES/historico
app.options('/api/ROULETTES/historico', (req, res) => {
  console.log('[CORS] Requisição OPTIONS recebida para /api/ROULETTES/historico');
  
  // Aplicar cabeçalhos CORS necessários
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Max-Age', '86400'); // Cache por 24 horas
  
  // Responder imediatamente com sucesso
  res.status(204).end();
});

// Socket.IO connection handler
io.on('connection', async (socket) => {
  console.log(`Novo cliente conectado: ${socket.id}`);
  
  // Enviar dados iniciais para o cliente
  if (isConnected) {
    socket.emit('connection_success', { status: 'connected' });
    
    // Enviar os últimos números conhecidos para cada roleta
    socket.emit('initial_data', rouletteStatus);
    
    console.log('Enviados dados iniciais para o cliente');
  } else {
    socket.emit('connection_error', { status: 'MongoDB not connected' });
  }
  
  // Subscrever a uma roleta específica
  socket.on('subscribe', (roletaNome) => {
    if (typeof roletaNome === 'string' && roletaNome.trim()) {
      socket.join(roletaNome);
      console.log(`Cliente ${socket.id} subscrito à roleta: ${roletaNome}`);
    }
  });
  
  // Cancelar subscrição a uma roleta específica
  socket.on('unsubscribe', (roletaNome) => {
    if (typeof roletaNome === 'string' && roletaNome.trim()) {
      socket.leave(roletaNome);
      console.log(`Cliente ${socket.id} cancelou subscrição à roleta: ${roletaNome}`);
    }
  });
  
  // Handler para novo número
  socket.on('new_number', async (data) => {
    try {
      console.log('[WebSocket] Recebido novo número:', data);
      
      // Adicionar o número ao histórico
      if (historyModel && data.roletaId && data.numero !== undefined) {
        await historyModel.addNumberToHistory(
          data.roletaId,
          data.roletaNome || `Roleta ${data.roletaId}`,
          data.numero
        );
        console.log(`[WebSocket] Número ${data.numero} adicionado ao histórico da roleta ${data.roletaId}`);
      }
      
      // Broadcast para todos os clientes inscritos nesta roleta
      if (data.roletaNome) {
        io.to(data.roletaNome).emit('new_number', data);
        console.log(`[WebSocket] Evento 'new_number' emitido para sala ${data.roletaNome}`);
      }
      
      // Broadcast global para todos os clientes
      io.emit('global_new_number', data);
    } catch (error) {
      console.error('[WebSocket] Erro ao processar novo número:', error);
    }
  });
  
  // Handler para solicitar histórico completo de uma roleta
  socket.on('request_history', async (data) => {
    try {
      if (!historyModel) {
        await initializeModels();
      }
      
      if (!data || !data.roletaId) {
        return socket.emit('history_error', { error: 'ID da roleta é obrigatório' });
      }
      
      console.log(`[WebSocket] Solicitação de histórico para roleta ${data.roletaId}`);
      
      const history = await historyModel.getHistoryByRouletteId(data.roletaId);
      
      socket.emit('history_data', {
        roletaId: data.roletaId,
        ...history
      });
      
      console.log(`[WebSocket] Histórico enviado: ${history.numeros ? history.numeros.length : 0} números`);
    } catch (error) {
      console.error('[WebSocket] Erro ao buscar histórico:', error);
      socket.emit('history_error', { error: 'Erro ao buscar histórico' });
    }
  });
  
  // Evento de desconexão
  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Iniciar o servidor
server.listen(PORT, async () => {
  console.log(`Servidor WebSocket rodando na porta ${PORT}`);
  
  // Inicializar conexão com MongoDB e modelos
  await connectToMongoDB();
});

// Tratar sinais de encerramento do processo
process.on('SIGINT', () => {
  console.log('Encerrando servidor...');
  process.exit(0);
});

// Rota para verificar o status do MongoDB e dados disponíveis
app.get('/api/status', async (req, res) => {
  console.log('[API] Requisição recebida para /api/status');
  
  // Aplicar cabeçalhos CORS
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  try {
    if (!isConnected || !db || !collection) {
      return res.status(503).json({
        status: 'error',
        connected: false,
        message: 'Servidor não está conectado ao MongoDB'
      });
    }
    
    // Verificar configurações atuais
    const dbName = db.databaseName;
    const collectionName = collection.collectionName;
    
    // Verificar contagem de documentos
    const count = await collection.countDocuments();
    
    // Obter amostra de documentos
    const recentDocs = count > 0 
      ? await collection.find().sort({timestamp: -1}).limit(5).toArray()
      : [];
    
    // Obter lista de coleções
    const collections = await db.listCollections().toArray();
    const collectionsList = collections.map(c => c.name);
    
    // Retornar status completo
    return res.json({
      status: 'ok',
      connected: true,
      database: {
        name: dbName,
        collection: collectionName,
        documentCount: count,
        collections: collectionsList
      },
      recentDocuments: recentDocs,
      connection: {
        uri: MONGODB_URI.replace(/:.*@/, ':****@'),
      }
    });
    
  } catch (error) {
    console.error('[API] Erro ao verificar status:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Erro interno ao verificar status',
      error: error.message
    });
  }
});

// Endpoint para verificar o status da assinatura do usuário
app.get('/api/subscription/status',
  verifyTokenAndSubscription({ required: false }),
  (req, res) => {
    console.log('[API] Verificação de status de assinatura');
    console.log('[API] Usuário:', req.usuario?.id);
    console.log('[API] Plano:', req.userPlan?.type);
    
    const temAssinatura = !!req.subscription;
    const plano = req.userPlan?.type || 'FREE';
    
    res.json({
      success: true,
      hasSubscription: temAssinatura,
      plan: plano,
      subscription: req.subscription ? {
        id: req.subscription.id || req.subscription._id,
        status: req.subscription.status,
        expiresAt: req.subscription.validade || req.subscription.expiresAt
      } : null,
      message: temAssinatura 
        ? `Assinatura ativa: plano ${plano}` 
        : 'Usuário não possui assinatura ativa'
    });
});

// Endpoint para diagnóstico de autenticação e assinatura
app.get('/api/auth-test', 
  verifyTokenAndSubscription({ required: false }), 
  (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API ${requestId}] Requisição para diagnóstico de autenticação`);
    
    // Coletar informações sobre o request e a autenticação
    const info = {
      requestId: requestId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      authenticated: !!req.usuario,
      hasSubscription: !!req.subscription,
      userInfo: req.usuario ? {
        id: req.usuario.id,
        username: req.usuario.username,
        email: req.usuario.email
      } : null,
      subscriptionInfo: req.subscription ? {
        id: req.subscription.id || req.subscription._id,
        status: req.subscription.status,
        plan: req.userPlan?.type,
        expiresAt: req.subscription.validade || req.subscription.expiresAt
      } : null,
      headers: {
        authorization: req.headers.authorization ? 'Bearer [redacted]' : null,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        host: req.headers.host
      },
      client: {
        ip: req.ip,
        protocol: req.protocol
      }
    };
    
    console.log(`[API ${requestId}] Resultado do diagnóstico:`, 
      JSON.stringify({
        authenticated: info.authenticated,
        hasSubscription: info.hasSubscription,
        plan: info.subscriptionInfo?.plan
      })
    );
    
    res.json(info);
});

// Adicionar rotas específicas para todas as variantes observadas
// Variante: roletas?_I
app.get('/api/roletas', verifyTokenAndSubscription({ 
  required: true, 
  allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
}));

// Variante: ROULETTES7_I
app.get('/api/ROULETTES7_*', verifyTokenAndSubscription({ 
  required: true, 
  allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
}));

// Variante: ROULETTES com qualquer sufixo
app.get('/api/ROULETTES*', verifyTokenAndSubscription({ 
  required: true, 
  allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
}));

// Variante: roulettes com qualquer sufixo
app.get('/api/roulettes*', verifyTokenAndSubscription({ 
  required: true, 
  allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] 
}));

// Handler específico para requisições com _I
app.get('*', (req, res, next) => {
  // Verificar se a URL contém o parâmetro _I=
  const originalUrl = req.originalUrl || req.url;
  
  if (originalUrl.includes('_I=')) {
    const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
    console.log(`[I-PARAM ${requestId}] Detectado parâmetro _I= na requisição: ${originalUrl}`);
    
    // Verificar se a URL também contém 'roulettes', 'ROULETTES', ou 'roletas'
    const isRouletteEndpoint = (
      originalUrl.includes('/api/roulettes') || 
      originalUrl.includes('/api/ROULETTES') || 
      originalUrl.includes('/api/roletas')
    );
    
    if (isRouletteEndpoint) {
      console.log(`[I-PARAM ${requestId}] Interceptando requisição com _I= para endpoint de roletas`);
      
      // Se já tiver passado pela autenticação, deixar prosseguir
      if (req.hasOwnProperty('usuario') && req.hasOwnProperty('subscription') && req.subscription) {
        console.log(`[I-PARAM ${requestId}] Requisição já autenticada, permitindo acesso`);
        return next();
      }
      
      // Caso contrário, bloquear a requisição
      console.log(`[I-PARAM ${requestId}] Bloqueando requisição não autenticada com _I=`);
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado - Autenticação obrigatória',
        code: 'I_PARAM_BLOCKER',
        path: originalUrl,
        requestId: requestId
      });
    }
  }
  
  // Se não contém _I= ou não é um endpoint de roletas, continuar
  next();
});

// Adicionar headers anti-cache para TODAS as rotas de roleta
app.use(['/api/roulettes*', '/api/ROULETTES*', '/api/roletas*'], (req, res, next) => {
  // Definir cabeçalhos anti-cache extremamente rigorosos
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Adicionar cabeçalho único para evitar cache
  res.setHeader('X-No-Cache', Date.now().toString());
  
  // Continuar para o próximo middleware
  next();
});

// Adicionar verificação de token JWT para TODAS as rotas de roleta (verificação tripla)
app.use(['/api/roulettes*', '/api/ROULETTES*', '/api/roletas*'], (req, res, next) => {
  const requestId = Math.random().toString(36).substring(2, 12);
  
  // Se o método for OPTIONS, pular verificação (pre-flight CORS)
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  console.log(`[TRIPLE-CHECK ${requestId}] Verificação tripla para ${req.method} ${req.originalUrl}`);
  
  // Verificar cabeçalho de autorização
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[TRIPLE-CHECK ${requestId}] Falha na verificação tripla: sem token de autorização`);
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Token de autenticação é obrigatório',
      code: 'TRIPLE_CHECK_NO_TOKEN',
      requestId
    });
  }
  
  // Extrair e verificar o token JWT
  try {
    const token = authHeader.slice(7); // Remove 'Bearer '
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
    
    // Verificar token
    const decoded = jwt.verify(token, secret);
    
    if (!decoded || !decoded.id) {
      console.log(`[TRIPLE-CHECK ${requestId}] Falha na verificação tripla: token JWT inválido`);
      return res.status(401).json({
        success: false,
        message: 'Acesso negado - Token de autenticação inválido',
        code: 'TRIPLE_CHECK_INVALID_TOKEN',
        requestId
      });
    }
    
    console.log(`[TRIPLE-CHECK ${requestId}] ✓ Verificação tripla: token válido para usuário ${decoded.id}`);
    next();
  } catch (error) {
    console.error(`[TRIPLE-CHECK ${requestId}] Falha na verificação tripla: erro no JWT:`, error.message);
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Token de autenticação inválido ou expirado',
      code: 'TRIPLE_CHECK_JWT_ERROR',
      requestId,
      error: error.message
    });
  }
});

// Endpoint de status detalhado do servidor
app.get('/api/server-status', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 12);
  console.log(`[STATUS ${requestId}] Verificação de status do servidor`);
  
  // Verificar status do MongoDB
  let mongoStatus = 'offline';
  let dbLatency = null;
  
  if (isConnected && collection) {
    try {
      const startTime = Date.now();
      // Ping rápido ao MongoDB
      await client.db("admin").command({ ping: 1 });
      dbLatency = Date.now() - startTime;
      mongoStatus = 'online';
    } catch (error) {
      console.error(`[STATUS ${requestId}] Erro ao verificar MongoDB:`, error);
      mongoStatus = 'error';
    }
  }
  
  // Coletar estatísticas do servidor
  const os = require('os');
  const serverInfo = {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    freeMemory: Math.round(os.freemem() / 1024 / 1024) + 'MB',
    totalMemory: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
    uptime: Math.round(os.uptime() / 60 / 60) + ' horas',
    loadAvg: os.loadavg()
  };
  
  // Coletar informações da versão do Node.js
  const nodeInfo = {
    version: process.version,
    modules: process.versions,
  };
  
  // Retornar resposta detalhada
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    requestId,
    server: {
      environment: process.env.NODE_ENV || 'production',
      processUptime: Math.round(process.uptime() / 60 / 60 * 10) / 10 + ' horas',
      ...serverInfo
    },
    database: {
      status: mongoStatus,
      latency: dbLatency ? `${dbLatency}ms` : null
    },
    node: nodeInfo
  });
});

// Middleware de tratamento de erros global
// IMPORTANTE: Este middleware deve ser adicionado APÓS todas as outras rotas
app.use((err, req, res, next) => {
  const requestId = Math.random().toString(36).substring(2, 12);
  console.error(`[ERROR ${requestId}] Erro não tratado:`, err);
  
  // Log detalhado para depuração
  console.error(`[ERROR ${requestId}] Stack:`, err.stack);
  console.error(`[ERROR ${requestId}] URL: ${req.method} ${req.originalUrl}`);
  console.error(`[ERROR ${requestId}] Parâmetros:`, {
    query: req.query,
    body: req.body,
    params: req.params
  });
  
  // Evitar que o cache armazene respostas de erro
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  // Retornar resposta de erro formatada
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    requestId,
    timestamp: new Date().toISOString()
  });
});

// Endpoint LiveFeed que só aceita método POST - similar ao exemplo cgp.safe-iplay.com
app.post('/api/liveFeed/GetLiveTables', 
  requireFormUrlEncoded(), // Exige application/x-www-form-urlencoded como no exemplo
  verifyTokenAndSubscription({ required: true, allowedPlans: ['BASIC', 'PRO', 'PREMIUM', 'basic', 'pro', 'premium'] }),
  async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[LIVE-FEED ${requestId}] Nova requisição POST para LiveFeed`);
    console.log(`[LIVE-FEED ${requestId}] Body: ${JSON.stringify(req.body)}`);
    
    // Aplicar cabeçalhos EXATAMENTE como no exemplo fornecido
    res.header('access-control-allow-origin', '*');
    res.header('access-control-expose-headers', 'current-client-request-ip');
    res.header('cache-control', 'public, max-age=0, must-revalidate');
    res.header('content-type', 'application/json; charset=utf-8');
    res.header('date', new Date().toUTCString());
    res.header('vary', 'Accept-Encoding');
    res.header('x-cdn', 'Imperva');
    res.header('serverid', '02');
    
    // Configurar cookies exatamente como no exemplo, ajustados para nosso domínio
    const domainBase = req.hostname.split('.').slice(-2).join('.');
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Expira em 1 ano
    
    const visitorId = `visid_incap_${Math.floor(Math.random() * 10000000)}`;
    const sessionId = `incap_ses_${Math.floor(Math.random() * 1000)}_${Math.floor(Math.random() * 10000000)}`;
    
    res.cookie(visitorId, generateRandomString(32), {
      expires: expiryDate,
      httpOnly: true,
      path: '/',
      domain: `.${domainBase}`
    });
    
    res.cookie(sessionId, generateRandomString(32), {
      path: '/',
      domain: `.${domainBase}`
    });

    // Adicionar cabeçalho com informações do cliente (como no x-iinfo do exemplo)
    const clientInfo = `${Math.floor(Math.random() * 100)}-${Math.floor(Math.random() * 100000000)}-${Math.floor(Math.random() * 100000000)} NNNY CT(${Math.floor(Math.random() * 1000)} ${Math.floor(Math.random() * 1000)} 0) RT(${Date.now()} ${Math.floor(Math.random() * 1000)}) q(0 0 0 1) r(2 2) U24`;
    res.header('x-iinfo', clientInfo);
    
    try {
      if (!isConnected || !collection) {
        console.log(`[LIVE-FEED ${requestId}] MongoDB não conectado, retornando erro`);
        return res.status(503).json({
          success: false,
          message: 'Serviço temporariamente indisponível',
          code: 'DATABASE_OFFLINE',
          requestId
        });
      }
      
      // VERIFICAÇÃO DE SEGURANÇA (similar às outras rotas)
      if (!req.usuario || !req.subscription) {
        console.log(`[LIVE-FEED ${requestId}] Acesso não autenticado ou sem assinatura`);
        return res.status(401).json({
          success: false,
          message: 'Acesso negado - Autenticação e assinatura são obrigatórias',
          code: 'AUTH_REQUIRED',
          requestId
        });
      }
      
      // Obter dados de todas as roletas ativas
      const roulettes = await collection.aggregate([
        { $sort: { timestamp: -1 } },
        { $group: { 
            _id: "$roleta_nome", 
            roleta_id: { $first: "$roleta_id" }, 
            ultimo_numero: { $first: "$numero" }, 
            ultima_cor: { $first: "$cor" },
            timestamp: { $first: "$timestamp" },
            total_registros: { $sum: 1 }
          }
        },
        { $project: {
            _id: 0,
            TableId: "$roleta_id",
            TableName: "$_id",
            LastNumber: "$ultimo_numero",
            LastColor: "$ultima_cor",
            UpdateTime: "$timestamp",
            TotalHistory: "$total_registros",
            IsActive: true,
            DealerName: { $concat: ["Dealer ", { $substr: ["$_id", 0, 1] }] },
            Status: "InPlay"
          }
        }
      ]).toArray();
      
      // Adicionar estatísticas e metadados (similar ao exemplo)
      const result = {
        Tables: roulettes,
        TotalTables: roulettes.length,
        UpdateTime: new Date().toISOString(),
        ServerTime: Date.now(),
        RequestId: requestId,
        ClientIP: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      };
      
      console.log(`[LIVE-FEED ${requestId}] Retornando ${roulettes.length} roletas para usuário ${req.usuario.id}`);
      
      // Retornar estrutura similar ao exemplo
      return res.json(result);
    } catch (error) {
      console.error(`[LIVE-FEED ${requestId}] Erro:`, error);
      return res.status(500).json({ 
        Message: 'Erro interno ao processar requisição',
        ErrorCode: 'SERVER_ERROR',
        RequestId: requestId
      });
    }
});

// Manipulador para método GET no mesmo endpoint - retornar erro similar ao exemplo
app.get('/api/liveFeed/GetLiveTables', (req, res) => {
  // Aplicar cabeçalhos CORS e cache-control iguais ao exemplo
  res.header('access-control-allow-origin', '*');
  res.header('access-control-expose-headers', 'current-client-request-ip');
  res.header('cache-control', 'public, max-age=0, must-revalidate');
  res.header('content-type', 'application/json; charset=utf-8');
  res.header('vary', 'Accept-Encoding');
  
  // Retornar erro específico como no exemplo
  res.status(405).json({
    Message: "The requested resource does not support http method 'GET'."
  });
});

// Handler OPTIONS para o endpoint LiveFeed
app.options('/api/liveFeed/GetLiveTables', (req, res) => {
  console.log('[CORS] Requisição OPTIONS recebida para /api/liveFeed/GetLiveTables');
  
  // Aplicar cabeçalhos CORS necessários compatíveis com o exemplo
  res.header('access-control-allow-origin', '*');
  res.header('access-control-allow-methods', 'POST, OPTIONS');
  res.header('access-control-allow-headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, User-Agent');
  res.header('access-control-max-age', '86400'); // Cache por 24 horas
  
  // Responder imediatamente com sucesso
  res.status(204).end();
});

// Função utilitária para gerar strings aleatórias para cookies (similar aos do exemplo)
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

// Adicionar nova rota de roletas usando o middleware JWT simples
app.get('/api/jwt-roulettes', 
  authenticateToken({ required: true }), 
  async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[API-JWT ${requestId}] Requisição recebida para /api/jwt-roulettes`);
    console.log(`[API-JWT ${requestId}] Usuário: ${req.user?.id} (${req.user?.username})`);
    
    try {
      if (!isConnected || !collection) {
        console.log(`[API-JWT ${requestId}] MongoDB não conectado, retornando array vazio`);
        return res.json([]);
      }
      
      // Log de acesso bem-sucedido
      console.log(`[API-JWT ${requestId}] ACESSO PERMITIDO: Usuário autenticado com JWT válido`);
      
      // Obter roletas únicas da coleção
      const roulettes = await collection.aggregate([
        { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
        { $project: { _id: 0, id: 1, nome: "$_id" } }
      ]).toArray();
      
      console.log(`[API-JWT ${requestId}] Processadas ${roulettes.length} roletas para usuário ${req.user?.username}`);
      
      // Adicionar detalhes para diferenciar da rota antiga
      res.json({
        success: true,
        message: 'Dados obtidos com JWT simples',
        requestId,
        user: {
          id: req.user?.id,
          username: req.user?.username,
          roles: req.user?.roles
        },
        timestamp: new Date().toISOString(),
        data: roulettes
      });
    } catch (error) {
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

// ===== MODIFICAÇÃO PARA BLOQUEAR ACESSO DIRETO A ENDPOINT DE ROLETAS =====
// Middleware simplificado para bloqueio absoluto de acesso sem JWT
const blockDirectAccess = (req, res, next) => {
  // Gerar ID de requisição para rastreamento
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[BLOQUEIO-ABSOLUTO ${requestId}] Verificando acesso a: ${req.originalUrl}`);
  
  // Verificar cabeçalho de autorização
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[BLOQUEIO-ABSOLUTO ${requestId}] Acesso bloqueado: Token ausente`);
    return res.status(401).json({ 
      error: "Acesso negado - Token JWT ausente", 
      requestId 
    });
  }
  
  try {
    // Extrair e verificar o token
    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
    const jwt = require('jsonwebtoken');
    
    // Verificar se o token é válido - lança erro se inválido
    const decoded = jwt.verify(token, secret);
    if (!decoded || !decoded.id) {
      console.log(`[BLOQUEIO-ABSOLUTO ${requestId}] Acesso bloqueado: Token malformado`);
      return res.status(403).json({ 
        error: "Acesso negado - Token JWT inválido", 
        requestId 
      });
    }
    
    // Verificar User-Agent para identificar navegadores
    const userAgent = req.headers['user-agent'] || '';
    const isDirectBrowserAccess = (
      userAgent.includes('Mozilla') || 
      userAgent.includes('Chrome') || 
      userAgent.includes('Safari') || 
      userAgent.includes('Firefox') || 
      userAgent.includes('Edge') ||
      userAgent.includes('Opera')
    );
    
    // Bloquear acesso direto via navegador (exceto em ambiente de desenvolvimento)
    if (isDirectBrowserAccess && process.env.NODE_ENV !== 'development') {
      console.log(`[BLOQUEIO-ABSOLUTO ${requestId}] Acesso bloqueado: Navegador detectado - ${userAgent}`);
      return res.status(403).json({ 
        error: "Acesso direto via navegador não permitido", 
        requestId 
      });
    }
    
    // Se passar por todas as verificações, permitir o acesso
    req.user = decoded;
    console.log(`[BLOQUEIO-ABSOLUTO ${requestId}] Acesso permitido para usuário: ${decoded.id}`);
    next();
  } catch (error) {
    console.log(`[BLOQUEIO-ABSOLUTO ${requestId}] Acesso bloqueado: ${error.message}`);
    return res.status(403).json({ 
      error: "Acesso negado - " + error.message, 
      requestId 
    });
  }
};

// Aplicar o middleware de bloqueio em TODAS as rotas de roletas, sobrepondo configurações anteriores
// IMPORTANTE: Este middleware será executado ANTES de qualquer rota definida após esta linha
app.use([
  '/api/roulettes', 
  '/api/ROULETTES', 
  '/api/roletas',
  '/api/roulettes/*', 
  '/api/ROULETTES/*', 
  '/api/roletas/*'
], blockDirectAccess);

// Redefinir a rota /api/roulettes com uma implementação mais simples
app.get('/api/roulettes', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[API ${requestId}] Requisição autenticada para /api/roulettes`);
  console.log(`[API ${requestId}] Usuário: ${req.user?.id}`);
  
  try {
    if (!isConnected || !collection) {
      console.log(`[API ${requestId}] MongoDB não conectado, retornando array vazio`);
      return res.json([]);
    }
    
    // Obter roletas únicas da coleção
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[API ${requestId}] Retornando ${roulettes.length} roletas para usuário ${req.user?.id}`);
    res.json(roulettes);
  } catch (error) {
    console.error(`[API ${requestId}] Erro ao listar roletas:`, error);
    res.status(500).json({ 
      error: 'Erro interno ao buscar roletas',
      message: error.message,
      requestId: requestId 
    });
  }
});

// Também redefinir a rota em maiúsculas
app.get('/api/ROULETTES', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[API ${requestId}] Requisição autenticada para /api/ROULETTES`);
  
  try {
    if (!isConnected || !collection) {
      return res.json([]);
    }
    
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    res.json(roulettes);
  } catch (error) {
    console.error(`[API ${requestId}] Erro:`, error);
    res.status(500).json({ error: 'Erro interno ao buscar roletas' });
  }
});

// Adicionar um middleware de verificação de JWT obrigatório para TODAS as rotas de roleta
// Este middleware será aplicado ANTES de qualquer definição de rota
app.use([
  '/api/roulettes*', 
  '/api/ROULETTES*', 
  '/api/roletas*'
], (req, res, next) => {
  // Se for uma requisição OPTIONS, deixar passar para o handler de CORS
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[BLOQUEIO-JWT ${requestId}] Verificando JWT para: ${req.originalUrl}`);
  
  // Verificar se há token de autorização válido
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[BLOQUEIO-JWT ${requestId}] Acesso bloqueado: Token ausente`);
    
    // Verificar se é um navegador para retornar resposta apropriada
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || 
                      userAgent.includes('Safari') || userAgent.includes('Firefox');
    
    // Se for navegador, retornar página HTML com instruções
    if (isBrowser) {
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Acesso Negado | API RunCashh</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
            h1 { color: #e53935; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; }
            .info { background: #e3f2fd; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
          </style>
        </head>
        <body>
          <h1>⛔ Acesso Direto Não Permitido</h1>
          <p>Este endpoint requer autenticação com token JWT válido e não pode ser acessado diretamente pelo navegador.</p>
          
          <div class="info">
            <strong>Detalhes da requisição:</strong>
            <ul>
              <li>URL: ${req.originalUrl}</li>
              <li>Método: ${req.method}</li>
              <li>ID: ${requestId}</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <p>Para acessar este endpoint, você precisa:</p>
          <ol>
            <li>Fazer login na aplicação</li>
            <li>Obter um token JWT válido</li>
            <li>Incluir o token no cabeçalho Authorization</li>
          </ol>
          
          <p>Exemplo de requisição válida:</p>
          <pre>
fetch('${req.protocol}://${req.get('host')}${req.originalUrl}', {
  headers: {
    'Authorization': 'Bearer SEU_TOKEN_JWT_AQUI'
  }
})
          </pre>
        </body>
        </html>
      `);
    }
    
    // Se não for navegador, retornar JSON com erro
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Token de autenticação obrigatório',
      code: 'JWT_REQUIRED',
      requestId
    });
  }
  
  // Verificar a validade do token JWT
  try {
    const token = authHeader.slice(7); // Remove 'Bearer '
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'runcashh_secret_key';
    
    const decoded = jwt.verify(token, secret);
    
    if (!decoded || !decoded.id) {
      console.log(`[BLOQUEIO-JWT ${requestId}] Acesso bloqueado: Token inválido`);
      return res.status(403).json({
        success: false,
        message: 'Acesso negado - Token inválido ou malformado',
        code: 'INVALID_JWT',
        requestId
      });
    }
    
    // Adicionar dados do usuário à requisição
    req.user = decoded;
    console.log(`[BLOQUEIO-JWT ${requestId}] JWT válido para usuário ${decoded.id || decoded.username}`);
    
    // Continuar para o próximo middleware
    next();
  } catch (error) {
    console.error(`[BLOQUEIO-JWT ${requestId}] Erro ao verificar JWT: ${error.message}`);
    return res.status(403).json({
      success: false,
      message: `Acesso negado - ${error.message}`,
      code: 'JWT_ERROR',
      requestId
    });
  }
});

// NOVA definição para /api/roulettes
app.get('/api/roulettes', async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[API ${requestId}] Requisição autenticada para /api/roulettes`);
  console.log(`[API ${requestId}] Usuário: ${req.user.id}`);
  
  // Definir headers anti-cache rigorosos
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-No-Cache', Date.now().toString());
  
  try {
    if (!isConnected || !collection) {
      console.log(`[API ${requestId}] MongoDB não conectado, retornando array vazio`);
      return res.json([]);
    }
    
    // Obter roletas únicas da coleção
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[API ${requestId}] Retornando ${roulettes.length} roletas para usuário ${req.user.id}`);
    
    // Adicionar informações para debug
    return res.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      user: {
        id: req.user.id,
        username: req.user.username
      },
      data: roulettes
    });
  } catch (error) {
    console.error(`[API ${requestId}] Erro ao listar roletas:`, error);
    return res.status(500).json({ 
      success: false,
      error: 'Erro interno ao buscar roletas',
      message: error.message,
      requestId
    });
  }
});

// NOVA definição para /api/ROULETTES (maiúsculas para compatibilidade)
app.get('/api/ROULETTES', (req, res) => {
  // Simplesmente redirecionar para a rota padrão
  req.url = '/api/roulettes';
  app.handle(req, res);
});
