const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

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

// Importar middlewares
const { verifyTokenAndSubscription, requireResourceAccess } = require('./middlewares/asaasAuthMiddleware');
const requestLogger = require('./middlewares/requestLogger');
const securityEnforcer = require('./middlewares/securityEnforcer');

// Aplicar middleware de log para todas as requisições (antes de outros middlewares)
app.use(requestLogger());
console.log('Middleware de log de requisições configurado');

// Aplicar middleware de segurança para garantir que rotas protegidas sejam verificadas
app.use(securityEnforcer());
console.log('Middleware de segurança configurado');

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

// Middleware genérico para bloquear todas as variantes do endpoint roulettes sem autenticação
app.use((req, res, next) => {
  const path = req.originalUrl || req.url;
  const method = req.method;
  
  // Ignorar requisições OPTIONS
  if (method === 'OPTIONS') {
    return next();
  }
  
  // Verificar se é uma variante do endpoint de roletas
  const isRouletteVariant = (
    /\/api\/ROULETTES.*/.test(path) || 
    /\/api\/roulettes.*/.test(path) ||
    /\/api\/roletas.*/.test(path)
  );
  
  if (isRouletteVariant) {
    const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
    console.log(`[GLOBAL ${requestId}] Interceptando variante de roleta: ${path}`);
    
    // Se já foi processada por autenticação, deixar passar
    if (req.hasOwnProperty('usuario') && req.hasOwnProperty('subscription')) {
      console.log(`[GLOBAL ${requestId}] Requisição já autenticada, continuando...`);
      return next();
    }
    
    // Tentar iniciar a verificação de autenticação aqui se não estiver definida
    console.log(`[GLOBAL ${requestId}] Variante de roleta não autenticada: ${path}`);
    return res.status(401).json({
      success: false,
      message: 'Acesso negado - Autenticação necessária',
      code: 'GLOBAL_BLOCKER',
      path: path,
      requestId: requestId
    });
  }
  
  next();
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
    
    // IMPORTANTE: Verificação rigorosa de autenticação e assinatura
    if (!req.usuario) {
      console.log(`[API ${requestId}] BLOQUEIO DE SEGURANÇA: Usuário não autenticado`);
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para acessar este recurso',
        code: 'AUTH_REQUIRED',
        requestId: requestId
      });
    }
    
    // Verificação rigorosa de assinatura válida
    if (!req.subscription) {
      console.log(`[API ${requestId}] BLOQUEIO DE SEGURANÇA: Assinatura não encontrada`);
      return res.status(403).json({
        success: false,
        message: 'Você precisa de uma assinatura ativa para acessar este recurso',
        code: 'SUBSCRIPTION_REQUIRED',
        requestId: requestId
      });
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
    
    // IMPORTANTE: Verificação rigorosa de autenticação e assinatura
    if (!req.usuario) {
      console.log(`[API ${requestId}] BLOQUEIO DE SEGURANÇA: Usuário não autenticado`);
      return res.status(401).json({
        success: false,
        message: 'Autenticação necessária para acessar este recurso',
        code: 'AUTH_REQUIRED',
        requestId: requestId
      });
    }
    
    // Verificação rigorosa de assinatura válida
    if (!req.subscription) {
      console.log(`[API ${requestId}] BLOQUEIO DE SEGURANÇA: Assinatura não encontrada`);
      return res.status(403).json({
        success: false,
        message: 'Você precisa de uma assinatura ativa para acessar este recurso',
        code: 'SUBSCRIPTION_REQUIRED',
        requestId: requestId
      });
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