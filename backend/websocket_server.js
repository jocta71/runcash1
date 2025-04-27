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

// Middleware de autenticação para Socket.IO
io.use(async (socket, next) => {
  try {
    // Obter token da requisição
    const token = socket.handshake.auth.token || 
                 socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                 socket.handshake.query.token;
    
    // Se não houver token, permitir conexão mas marcar como não autenticado
    if (!token) {
      console.log('[Socket.IO] Conexão sem token de autenticação');
      socket.data.authenticated = false;
      socket.data.hasPlan = false;
      return next();
    }
    
    // Verificar token (usando função jwt ou outro método de seu sistema)
    // Esta é uma implementação simplificada, adapte à sua lógica de autenticação
    try {
      // Conectar ao MongoDB se ainda não estiver conectado
      if (!isConnected) {
        await connectToMongoDB();
      }
      
      // Verificar JWT no banco de dados ou através de decodificação
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seu_segredo_jwt');
      
      if (!decoded || !decoded.id) {
        throw new Error('Token inválido');
      }
      
      // Buscar o usuário no banco de dados
      const userId = decoded.id;
      const user = await db.collection('usuarios').findOne({ _id: userId });
      
      if (!user) {
        throw new Error('Usuário não encontrado');
      }
      
      // Verificar se o usuário tem uma assinatura ativa
      const subscription = await db.collection('subscriptions').findOne({
        user_id: userId,
        status: { $in: ['active', 'ACTIVE', 'ativa'] },
        expirationDate: { $gt: new Date() }
      });
      
      // Marcar o socket como autenticado
      socket.data.authenticated = true;
      socket.data.userId = userId;
      socket.data.hasPlan = !!subscription;
      socket.data.planType = subscription ? subscription.plan_id : null;
      
      console.log(`[Socket.IO] Usuário ${userId} autenticado, plano: ${socket.data.hasPlan ? socket.data.planType : 'nenhum'}`);
      
      return next();
    } catch (error) {
      console.error('[Socket.IO] Erro ao verificar token:', error.message);
      socket.data.authenticated = false;
      socket.data.hasPlan = false;
      return next();
    }
  } catch (error) {
    console.error('[Socket.IO] Erro no middleware de autenticação:', error.message);
    return next();
  }
});

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

// Função para iniciar o polling do MongoDB
function startPolling() {
  setInterval(async () => {
    try {
      if (!isConnected) {
        console.log('MongoDB não está conectado, tentando reconectar...');
        const success = await connectToMongoDB();
        if (!success) {
          console.log('Falha ao reconectar ao MongoDB, pulando ciclo de polling');
          return;
        }
      }
      
      await fetchAllRoulettesData();
    } catch (error) {
      console.error('Erro durante o polling:', error);
    }
  }, POLL_INTERVAL);
  console.log(`Iniciado polling a cada ${POLL_INTERVAL}ms`);
}

// Função para obter dados de todas as roletas
async function fetchAllRoulettesData() {
  try {
    if (!isConnected) {
      return false;
    }
    
    console.time('fetchAllRoulettesData');
    
    // Buscar todos os números das roletas
    const result = await collection.find({}).sort({ timestamp: -1 }).limit(100).toArray();
    
    if (!result || result.length === 0) {
      console.log('Nenhum número encontrado na coleção');
      return false;
    }
    
    console.log(`Obtidos ${result.length} números de roletas`);
    
    // Agrupar por roleta e pegar os últimos 30 de cada
    const rouletteMap = {};
    
    // Registrar os IDs processados nesta execução
    const processedIds = new Set();
    
    result.forEach(item => {
      // Adicionar ao conjunto de IDs processados
      processedIds.add(item._id.toString());
      
      // Pular se já processamos este ID
      if (lastProcessedIds.has(item._id.toString())) {
        return;
      }
      
      // Verificar se temos uma entrada para esta roleta
      if (!rouletteMap[item.roleta_id]) {
        rouletteMap[item.roleta_id] = {
          id: item.roleta_id,
          nome: item.roleta_nome || `Roleta ${item.roleta_id}`,
          numero: [],
          status: 'active',
          timestamp: new Date()
        };
      }
      
      // Adicionar número se ainda não temos 30
      if (rouletteMap[item.roleta_id].numero.length < 30) {
        rouletteMap[item.roleta_id].numero.push({
          numero: item.numero,
          timestamp: item.timestamp
        });
      }
    });
    
    // Atualizar o conjunto de IDs processados
    lastProcessedIds = processedIds;
    
    // Atualizar o status global
    rouletteStatus = Object.values(rouletteMap);
    
    console.timeEnd('fetchAllRoulettesData');
    
    // Enviar dados para todos os clientes conectados usando a função personalizada
    broadcastData('all_roulettes_update', rouletteStatus);
    
    return true;
  } catch (error) {
    console.error('Erro ao buscar dados das roletas:', error);
    return false;
  }
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
app.get('/api/roulettes', async (req, res) => {
  console.log('[API] Requisição recebida para /api/roulettes');
  
  try {
    if (!isConnected || !collection) {
      console.log('[API] MongoDB não conectado, retornando array vazio');
      return res.json([]);
    }
    
    // Obter roletas únicas da coleção
    const roulettes = await collection.aggregate([
      { $group: { _id: "$roleta_nome", id: { $first: "$roleta_id" } } },
      { $project: { _id: 0, id: 1, nome: "$_id" } }
    ]).toArray();
    
    console.log(`[API] Processadas ${roulettes.length} roletas`);
    res.json(roulettes);
  } catch (error) {
    console.error('[API] Erro ao listar roletas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar roletas' });
  }
});

// Rota para listar todas as roletas (endpoint em maiúsculas para compatibilidade)
app.get('/api/ROULETTES', async (req, res) => {
  console.log('[API] Requisição recebida para /api/ROULETTES (maiúsculas)');
  console.log('[API] Query params:', req.query);
  
  // Aplicar cabeçalhos CORS explicitamente para esta rota
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  try {
    if (!isConnected || !collection) {
      console.log('[API] MongoDB não conectado, retornando array vazio');
      return res.json([]);
    }
    
    // Verificar se a coleção tem dados
    const count = await collection.countDocuments();
    console.log(`[API] Total de documentos na coleção: ${count}`);
    
    if (count === 0) {
      console.log('[API] Nenhum dado encontrado na coleção');
      return res.json([]);
    }
    
    // Parâmetros de paginação
    const limit = parseInt(req.query.limit) || 200;
    console.log(`[API] Usando limit: ${limit}`);
    
    // Buscar histórico de números ordenados por timestamp
    const numeros = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    console.log(`[API] Retornando ${numeros.length} números do histórico`);
    
    // Verificar se temos dados para retornar
    if (numeros.length === 0) {
      console.log('[API] Nenhum número encontrado');
      return res.json([]);
    }
    
    // Log de alguns exemplos para diagnóstico
    console.log('[API] Exemplos de dados retornados:');
    console.log(JSON.stringify(numeros.slice(0, 2), null, 2));
    
    return res.json(numeros);
  } catch (error) {
    console.error('[API] Erro ao listar roletas ou histórico:', error);
    res.status(500).json({ error: 'Erro interno ao buscar dados' });
  }
});

// Rota para listar todas as roletas (endpoint em português - compatibilidade)
app.get('/api/roletas', async (req, res) => {
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
app.get('/api/numbers/:roletaNome', async (req, res) => {
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
app.get('/api/numbers/byid/:roletaId', async (req, res) => {
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
app.get('/api/roletas/:id', async (req, res) => {
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
app.get('/api/ROULETTES/historico', async (req, res) => {
  console.log('[API] Requisição recebida para /api/ROULETTES/historico');
  
  // Configurar CORS explicitamente para esta rota
  configureCors(req, res);
  
  // Responder com o histórico
  try {
    if (!isConnected || !collection) {
      console.log('[API] MongoDB não conectado, retornando array vazio');
      return res.json([]);
    }
    
    // Obter histórico de números jogados
    const historico = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(2000)  // Aumentado para retornar mais registros
      .toArray();
    
    if (historico.length > 0) {
      console.log(`[API] Retornando histórico com ${historico.length} entradas`);
      res.json(historico);
    } else {
      console.log('[API] Histórico vazio');
      res.status(404).json({ error: 'Histórico vazio' });
    }
  } catch (error) {
    console.error('[API] Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Manipulador OPTIONS específico para /api/ROULETTES
app.options('/api/ROULETTES', (req, res) => {
  console.log('[CORS] Requisição OPTIONS recebida para /api/ROULETTES');
  
  // Aplicar cabeçalhos CORS necessários
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Max-Age', '86400'); // Cache por 24 horas
  
  // Responder imediatamente com sucesso
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

// Função para enviar dados para todos os clientes conectados
function broadcastData(eventName, data) {
  try {
    // Verificar se há dados para enviar
    if (!data) {
      console.warn(`[WebSocket] Tentativa de broadcast sem dados para evento ${eventName}`);
      return;
    }
    
    // Contar clientes conectados
    const connectedClients = io.sockets.sockets.size;
    console.log(`[WebSocket] Enviando dados para ${connectedClients} clientes conectados`);
    
    // Se não houver clientes, não fazer nada
    if (connectedClients === 0) {
      return;
    }
    
    // Iterar sobre todos os sockets conectados
    io.sockets.sockets.forEach((socket) => {
      // Verificar se o socket tem informações de plano
      const hasPlan = socket.data?.hasPlan === true;
      const isAuthenticated = socket.data?.authenticated === true;
      
      // Preparar dados com base no status de assinatura
      let clientData;
      
      if (hasPlan) {
        // Cliente com plano recebe dados completos
        clientData = data;
      } else if (isAuthenticated) {
        // Cliente autenticado mas sem plano recebe dados limitados
        clientData = limitDataForNonSubscribers(data, 'authenticated');
      } else {
        // Cliente não autenticado recebe dados mínimos
        clientData = limitDataForNonSubscribers(data, 'anonymous');
      }
      
      // Enviar dados para o cliente
      socket.emit(eventName, clientData);
    });
  } catch (error) {
    console.error(`[WebSocket] Erro ao fazer broadcast de dados: ${error.message}`);
  }
}

// Função para limitar dados para usuários sem assinatura
function limitDataForNonSubscribers(data, userType = 'anonymous') {
  // Se for um array (como lista de roletas)
  if (Array.isArray(data)) {
    // Limitar número de itens e profundidade dos dados
    const limitedItems = data.slice(0, userType === 'authenticated' ? 3 : 1);
    
    // Para cada item, limitar a quantidade de informações
    return limitedItems.map(item => {
      // Obter apenas os dados necessários para visualização básica
      const limitedItem = {
        id: item.id,
        nome: item.nome,
        status: item.status,
        numero: [],
        amostra: true // Marca que é apenas uma amostra
      };
      
      // Para usuários autenticados, incluir alguns números para amostra
      if (userType === 'authenticated' && item.numero && Array.isArray(item.numero)) {
        limitedItem.numero = item.numero.slice(0, 3);
      }
      
      // Para não autenticados, incluir apenas o último número
      if (userType === 'anonymous' && item.numero && Array.isArray(item.numero) && item.numero.length > 0) {
        limitedItem.numero = [item.numero[0]];
      }
      
      return limitedItem;
    });
  }
  
  // Se for um objeto único (como atualização de estratégia)
  if (typeof data === 'object' && data !== null) {
    // Criar uma versão simplificada do objeto
    const limitedData = {
      ...data,
      amostra: true,
      mensagem: "Assine um plano para acessar dados completos"
    };
    
    // Remover dados estratégicos para usuários sem plano
    if (limitedData.estrategias) {
      delete limitedData.estrategias;
    }
    
    return limitedData;
  }
  
  // Para outros tipos de dados, retornar como está
  return data;
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  // Registro do evento de conexão
  const userType = socket.data?.hasPlan ? 'premium' : 
                  (socket.data?.authenticated ? 'autenticado' : 'anônimo');
  console.log(`[Socket.IO] Cliente conectado: ${socket.id} (Tipo: ${userType})`);
  
  // Enviar configuração inicial para o cliente
  socket.emit('config', {
    serverTimestamp: new Date(),
    isSubscriber: socket.data?.hasPlan === true,
    requiresSubscription: true,
    version: '2.0.0'
  });
  
  // Enviar dados iniciais para o cliente
  if (Object.keys(rouletteStatus).length > 0) {
    // Usar a função de broadcast para enviar dados conforme o plano do cliente
    const clientData = socket.data?.hasPlan ? 
                      rouletteStatus : 
                      limitDataForNonSubscribers(rouletteStatus, 
                        socket.data?.authenticated ? 'authenticated' : 'anonymous');
    
    socket.emit('initial_data', clientData);
  }
  
  // Evento de pedido de histórico
  socket.on('request_history', async (data) => {
    try {
      if (!data || !data.roletaId) {
        return socket.emit('history_error', { 
          error: 'ID da roleta não fornecido', 
          requiresSubscription: !socket.data?.hasPlan 
        });
      }
      
      const roletaId = data.roletaId;
      
      // Verificar se o cliente tem acesso aos dados históricos completos
      if (!socket.data?.hasPlan) {
        return socket.emit('history_data', {
          roletaId,
          amostra: true,
          numeros: [], // Não enviar números históricos para não assinantes
          mensagem: "Assine um plano para acessar o histórico completo"
        });
      }
      
      console.log(`[Socket.IO] Recebido pedido de histórico para roleta: ${roletaId}`);
      
      try {
        // Conexão com MongoDB já deve estar estabelecida
        if (!isConnected) {
          await connectToMongoDB();
        }
        
        // Buscar histórico da roleta
        const history = await historyModel.getRouletteHistory(roletaId);
        
        socket.emit('history_data', {
          roletaId,
          numeros: history
        });
      } catch (error) {
        console.error(`[Socket.IO] Erro ao buscar histórico: ${error.message}`);
        socket.emit('history_error', { error: 'Falha ao buscar histórico' });
      }
    } catch (error) {
      console.error(`[Socket.IO] Erro no handler de request_history: ${error.message}`);
      socket.emit('history_error', { error: 'Erro interno do servidor' });
    }
  });
  
  // Evento de pedido de atualização de todas as roletas
  socket.on('request_all_roulettes', async () => {
    try {
      // Obter dados atualizados
      await fetchAllRoulettesData();
      
      // Enviar dados adequados ao tipo de cliente
      const clientData = socket.data?.hasPlan ? 
                        rouletteStatus : 
                        limitDataForNonSubscribers(rouletteStatus, 
                          socket.data?.authenticated ? 'authenticated' : 'anonymous');
      
      socket.emit('all_roulettes_data', clientData);
    } catch (error) {
      console.error(`[Socket.IO] Erro ao processar pedido de todas as roletas: ${error.message}`);
      socket.emit('error', { message: 'Erro ao buscar dados das roletas' });
    }
  });
  
  // Evento de desconexão
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Cliente desconectado: ${socket.id}, Motivo: ${reason}`);
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