const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.g2ixx79.mongodb.net/runcash?retryWrites=true&w=majority&appName=runcash';
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = process.env.POLL_INTERVAL || 2000; // 2 segundos

// Informações de configuração
console.log('==== Configuração do Servidor WebSocket ====');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI.replace(/:.*@/, ':****@')}`);
console.log(`COLLECTION_NAME: ${COLLECTION_NAME}`);
console.log(`POLL_INTERVAL: ${POLL_INTERVAL}ms`);

// Desativando completamente CORS - conforme solicitado
console.log('CORS configurado para permitir apenas origens específicas');

// Inicializar Express
const app = express();

// Configurar CORS para permitir apenas origens específicas
app.use((req, res, next) => {
  const allowedOrigins = ['https://runcash11-ten.vercel.app', 'http://localhost:3000'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Para requisições sem origem ou de outras origens não permitidas
    console.log(`Requisição de origem não permitida: ${origin || 'desconhecida'}`);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
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

// Endpoint para testar CORS
app.get('/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS desativado - permitindo tudo',
    origin: req.headers.origin || 'unknown'
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

// Inicializar Socket.IO com configurações de CORS específicas
const io = new Server(server, {
  cors: {
    origin: ['https://runcash11-ten.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // Aumentar timeout para 60s
  pingInterval: 25000 // Verificar conexão a cada 25s
});

// Log para confirmar configuração
console.log('Socket.IO configurado com CORS para origens específicas e com timeouts aumentados');

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

async function connectToMongoDB() {
  try {
    console.log('Attempting to connect to MongoDB at:', MONGODB_URI);
    
    const client = new MongoClient(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    db = client.db();
    collection = db.collection(COLLECTION_NAME);
    isConnected = true;
    
    // Log database info
    const dbName = db.databaseName;
    const collections = await db.listCollections().toArray();
    console.log(`Database name: ${dbName}`);
    console.log('Available collections:', collections.map(c => c.name).join(', '));
    
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

// Função para buscar novos números do MongoDB
async function checkForNewNumbers() {
  if (!isConnected) {
    console.log('Sem conexão com MongoDB, tentando reconectar...');
    await connectToMongoDB();
    return;
  }
  
  try {
    // Obter os últimos 20 números inseridos
    const latestNumbers = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    
    if (latestNumbers.length === 0) {
      console.log('Nenhum número encontrado na coleção');
      return;
    }
    
    // Processar apenas novos números
    for (const number of latestNumbers) {
      const numberIdStr = number._id.toString();
      
      // Se já processamos este ID, pular
      if (lastProcessedIds.has(numberIdStr)) {
        continue;
      }
      
      // Adicionar ID à lista de processados
      lastProcessedIds.add(numberIdStr);
      
      // Evitar que a lista cresça indefinidamente
      if (lastProcessedIds.size > 100) {
        // Converter para array, remover os mais antigos, e converter de volta para Set
        const idsArray = Array.from(lastProcessedIds);
        lastProcessedIds = new Set(idsArray.slice(-50));
      }
      
      const roletaNome = number.roleta_nome;
      
      // Determinar a cor do número
      let cor = 'verde';
      if (number.numero > 0) {
        const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        cor = numerosVermelhos.includes(number.numero) ? 'vermelho' : 'preto';
      }
      
      // Formatar o evento
      const event = {
        type: 'new_number',
        roleta_id: number.roleta_id || 'unknown',
        roleta_nome: roletaNome,
        numero: number.numero,
        cor: number.cor || cor,
        timestamp: number.timestamp || new Date().toISOString()
      };
      
      // Emitir evento para todos os clientes subscritos a esta roleta
      io.to(roletaNome).emit('new_number', event);
      
      // Também emitir para o canal global
      io.emit('global_update', event);
      
      console.log(`Enviado evento para roleta ${roletaNome}: número ${number.numero}`);
    }

    // Verificar se há atualizações de estratégia na coleção principal
    const rouletteCollection = db.collection('roletas');
    const roletas = await rouletteCollection.find({}).toArray();
    
    for (const roleta of roletas) {
      // Verificar se a roleta tem dados de estratégia
      if (roleta.estado_estrategia) {
        // Garantir que temos um nome válido para a roleta
        const roletaNome = roleta.nome || roleta.roleta_nome || `Roleta ${roleta._id}`;
        
        // Formatar o evento de estratégia
        const strategyEvent = {
          type: 'strategy_update',
          roleta_id: roleta._id,
          roleta_nome: roletaNome,
          estado: roleta.estado_estrategia,
          numero_gatilho: roleta.numero_gatilho || 0,
          terminais_gatilho: roleta.terminais_gatilho || [],
          vitorias: roleta.vitorias || 0,
          derrotas: roleta.derrotas || 0,
          sugestao_display: roleta.sugestao_display || '',
          timestamp: roleta.updated_at || new Date().toISOString()
        };
        
        // Emitir evento de estratégia para clientes inscritos nesta roleta
        io.to(roletaNome).emit('strategy_update', strategyEvent);
        console.log(`Enviado evento de estratégia para roleta ${roletaNome}: estado ${strategyEvent.estado}`);
        
        // Também emitir para o canal global para garantir que todos recebam
        io.emit('global_strategy_update', strategyEvent);
      }
    }
    
    // Verificar também a nova coleção de histórico de estratégia
    try {
      // Obter os últimos dados de estratégia inseridos
      const historico_collection = db.collection('estrategia_historico_novo');
      const latest_strategies = await historico_collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(20)  // Aumentado para garantir que pegamos estratégias recentes de todas as roletas
        .toArray();
      
      if (latest_strategies.length > 0) {
        console.log(`Encontrados ${latest_strategies.length} registros de estratégia recentes`);
        
        // Processar os estratégias mais recentes (1 por roleta)
        const processedRoletas = new Set();
        
        for (const strategy of latest_strategies) {
          // Se já processamos esta roleta, pular
          if (processedRoletas.has(strategy.roleta_id)) {
            continue;
          }
          
          // Adicionar roleta à lista de processadas
          processedRoletas.add(strategy.roleta_id);
          
          // Garantir que temos um nome válido
          const roletaNome = strategy.roleta_nome || `Roleta ${strategy.roleta_id}`;
          
          // Formatar o evento de estratégia
          const strategyEvent = {
            type: 'strategy_update',
            roleta_id: strategy.roleta_id,
            roleta_nome: roletaNome,
            estado: strategy.estado_estrategia || strategy.estado || 'TRIGGER', // Forçar TRIGGER se não tiver estado
            numero_gatilho: strategy.numero_gatilho || 0,
            terminais_gatilho: strategy.terminais_gatilho || strategy.terminais || [],
            vitorias: typeof strategy.vitorias === 'number' ? strategy.vitorias : 0,
            derrotas: typeof strategy.derrotas === 'number' ? strategy.derrotas : 0,
            timestamp: strategy.timestamp || new Date().toISOString()
          };
          
          // Gerar uma sugestão de display com base no estado
          if (strategy.sugestao_display) {
            // Usar sugestão já existente se disponível
            strategyEvent.sugestao_display = strategy.sugestao_display;
          } else if (strategyEvent.estado === "NEUTRAL") {
            strategyEvent.sugestao_display = "AGUARDANDO GATILHO";
          } else if (strategyEvent.estado === "TRIGGER" && strategyEvent.terminais_gatilho.length > 0) {
            strategyEvent.sugestao_display = `APOSTAR NOS TERMINAIS: ${strategyEvent.terminais_gatilho.join(',')}`;
          } else if (strategyEvent.estado === "POST_GALE_NEUTRAL") {
            strategyEvent.sugestao_display = `GALE NOS TERMINAIS: ${strategyEvent.terminais_gatilho.join(',')}`;
          } else if (strategyEvent.estado === "MORTO") {
            strategyEvent.sugestao_display = "AGUARDANDO PRÓXIMO CICLO";
          } else {
            // Caso padrão para qualquer outro estado
            strategyEvent.sugestao_display = `APOSTAR NOS TERMINAIS: ${strategyEvent.terminais_gatilho.join(',')}`;
          }
          
          console.log(`Enviando atualização de estratégia para ${roletaNome}: estado=${strategyEvent.estado}, terminais=${strategyEvent.terminais_gatilho.join(',')}, sugestão=${strategyEvent.sugestao_display}, vitórias=${strategyEvent.vitorias}, derrotas=${strategyEvent.derrotas}`);
          
          // Emitir evento de estratégia para clientes inscritos nesta roleta
          io.to(roletaNome).emit('strategy_update', strategyEvent);
          
          // Emitir para o canal global também
          io.emit('global_strategy_update', strategyEvent);
          
          // Emitir no canal geral de estratégia
          io.emit('strategy_update', strategyEvent);
        }
      }
    } catch (historyError) {
      console.error('Erro ao verificar histórico de estratégia:', historyError);
    }
  } catch (error) {
    console.error('Erro ao verificar novos números:', error);
  }
}

// Iniciar polling para verificar novos dados regularmente
function startPolling() {
  console.log(`Iniciando polling a cada ${POLL_INTERVAL}ms`);
  
  // Verificar imediatamente e depois a cada intervalo
  checkForNewNumbers();
  
  setInterval(checkForNewNumbers, POLL_INTERVAL);
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
    const limit = parseInt(req.query.limit) || 20;
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