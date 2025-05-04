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

// Carregar variáveis de ambiente
dotenv.config();

// Extrair variáveis de ambiente
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'runcashh_secret_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';

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
    const cookies = req.cookies || {};
    
    // Se não tiver header de autorização, bloquear o acesso
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[FIREWALL ROOT ${requestId}] Acesso bloqueado a ${path} - Sem autorização`);
      console.log(`[FIREWALL ROOT ${requestId}] IP: ${req.ip}`);
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
    
    try {
      // Extrair token
      const token = authHeader.split(' ')[1];
      
      // Verificar token
      console.log(`Token encontrado no header: ${token.substring(0, 15)}...`);
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Definir informações do usuário na requisição
      req.user = decoded;
      console.log(`Token verificado com sucesso, usuário: ${req.user.id}`);
      
      // Importar e usar o middleware de verificação de assinatura
      const { checkSubscription } = require('./middleware/subscriptionCheck');
      
      // Criar uma função para simular o middleware Express com promessa
      const checkSubscriptionPromise = () => {
        return new Promise((resolve, reject) => {
          // Simular os objetos req/res/next do Express
          const nextFunction = () => {
            resolve(true); // Se o middleware chama next(), significa que o usuário pode acessar
          };
          
          const resObject = {
            status: (code) => ({
              json: (data) => {
                resolve({ code, data }); // Retorna o código e dados se o middleware bloquear
              }
            })
          };
          
          // Chamar o middleware
          checkSubscription(req, resObject, nextFunction).catch(reject);
        });
      };
      
      // Verificar assinatura
      const result = await checkSubscriptionPromise();
      
      // Se o resultado for um objeto com código e dados, o middleware bloqueou o acesso
      if (result !== true) {
        console.log(`[FIREWALL ROOT ${requestId}] Acesso bloqueado a ${path} - Sem assinatura válida`);
        return res.status(result.code).json(result.data);
      }
      
      // Se chegou aqui, o usuário passou por todas as verificações
      console.log(`[FIREWALL ROOT ${requestId}] Acesso permitido a ${path} - Token e assinatura válidos`);
      next();
    } catch (error) {
      console.log(`[FIREWALL ROOT ${requestId}] Erro ao verificar token: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado.',
        code: 'INVALID_TOKEN',
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    // Para todas as outras rotas, continuar normalmente
    next();
  }
});

// Configurar CORS
app.use(cors());

// Configurar middleware para parsing de JSON e URL encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Registrar rotas públicas - NOVIDADE: API pública com dados criptografados
// Estas rotas não requerem autenticação, mas os dados são criptografados
console.log('[Server] Registrando rotas públicas para roletas com dados criptografados');
const publicRouletteRoutes = require('./routes/publicRouletteRoutes');
app.use('/api/public', publicRouletteRoutes);

// Carregar outros middlewares e rotas da API
console.log('[Server] Carregando outros middlewares e rotas da API');

// Carregar routes do diretório /api se existir
try {
  const apiPath = path.join(__dirname, 'api');
  if (fs.existsSync(apiPath)) {
    console.log('[Server] Diretório /api encontrado, carregando rotas...');
    
    // Carregar rotas individuais
    try {
      const routesPath = path.join(apiPath, 'routes');
      if (fs.existsSync(routesPath)) {
        // ... resto do código
      }
    } catch (err) {
      console.error('Erro ao carregar rotas individuais:', err);
    }
  }
} catch (err) {
  console.error('Erro ao carregar rotas da API:', err);
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

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`[Server] Servidor unificado iniciado na porta ${PORT}`);
  console.log('[Server] Endpoints disponíveis:');
  console.log('- / (status do servidor)');
  console.log('- /api (rotas da API principal)');
  console.log('- /api/public (nova API pública com dados criptografados)');
  console.log('- /emit-event (compatibilidade com WebSocket, se ativado)');
});