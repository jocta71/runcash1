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

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://runcashh11.vercel.app";

console.log('=== RunCash Unified Server ===');
console.log(`Porta: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log(`Frontend URL: ${FRONTEND_URL}`);
console.log('Diretório atual:', process.cwd());

// Verificar e atualizar configuração do callback do Google
try {
  require('./update_google_callback');
  console.log('[Server] Verificação do callback do Google concluída');
} catch (err) {
  console.warn('[Server] Erro ao verificar callback do Google:', err.message);
}

// Inicializar app Express
const app = express();

// Configuração CORS correta para suportar credenciais
const corsOptions = {
  origin: function(origin, callback) {
    // Permitir requisições de desenvolvimento sem origem (como Postman)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      FRONTEND_URL,                         // Frontend principal
      'http://localhost:3000',              // Desenvolvimento local
      'http://localhost:5173',              // Desenvolvimento local (Vite)
      'https://runcashh11.vercel.app',      // Frontend em produção
      /\.vercel\.app$/                      // Qualquer ambiente Vercel (para previews)
    ];
    
    // Verificar se a origem é permitida
    const allowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (allowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origem não permitida: ${origin}`);
      callback(new Error('Não permitido pela política CORS'));
    }
  },
  credentials: true,                        // Habilitar credenciais (cookies, auth headers)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'asaas-access-token', 'x-requested-with']
};

// Aplicar CORS à aplicação principal
app.use(cors(corsOptions));
app.use(express.json());

// Criar servidor HTTP e Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    credentials: true
  }
});

// Conectar ao MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Conectado ao MongoDB Atlas com sucesso');
    return client.db();
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    return null;
  }
}

// Configurar Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
  
  // Exemplo de evento para receber e distribuir números de roleta
  socket.on('roulette_number', (data) => {
    console.log('📊 Número recebido:', data);
    
    // Enviar para todos os clientes conectados
    io.emit('roulette_number', data);
  });
  
  // Outros eventos do socket podem ser adicionados aqui...
});

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
  res.send('RunCash API e WebSocket Server - Online');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
async function startServer() {
  // Conectar ao MongoDB
  const db = await connectToMongoDB();
  
  // Iniciar servidor HTTP
  server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Socket.IO disponível`);
  });
}

// Iniciar o servidor
startServer();