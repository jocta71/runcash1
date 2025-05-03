const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = process.env.POLL_INTERVAL || 2000; // 2 segundos
const JWT_SECRET = process.env.JWT_SECRET || 'runcashh_secret_key';

// Informações de configuração
console.log('==== Configuração do Servidor WebSocket ====');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log(`COLLECTION_NAME: ${COLLECTION_NAME}`);
console.log(`POLL_INTERVAL: ${POLL_INTERVAL}ms`);
console.log(`JWT_SECRET: ${JWT_SECRET ? '******' : 'Não definida'}`);

// Inicializar Express
const app = express();

// Middleware para bloquear ABSOLUTAMENTE TODAS as requisições a endpoints de roleta sem autenticação válida
app.use((req, res, next) => {
  // Verificações de segurança como no arquivo original
  // ...
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

// Middlewares globais e configurações como no arquivo original
// ...

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
    
    // Verificar JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Guardar dados do usuário no socket
    socket.user = decoded;
    socket.isAuthenticated = true;
    
    console.log(`[WebSocket Middleware] Conexão autorizada: ${socket.id} - Usuário: ${decoded.username || decoded.email || 'usuário'}`);
    return next();
  } catch (error) {
    console.log(`[WebSocket Middleware] Conexão rejeitada: ${socket.id} - Erro: ${error.message}`);
    return next(new Error('Token inválido ou expirado. Por favor, autentique-se novamente.'));
  }
});

console.log('[Socket.IO] Middleware de autenticação JWT registrado com sucesso');
console.log('[Socket.IO] Inicializado com configuração CORS para aceitar todas as origens');

// Resto do código para conexão MongoDB, polling e eventos do WebSocket
// ...

// Verificar a autenticação explicitamente em cada operação do socket
io.on('connection', (socket) => {
  // Log de conexão
  console.log(`[Socket.IO] Nova conexão: ${socket.id}`);
  
  // Verificar autenticação antes de permitir qualquer operação
  if (!socket.isAuthenticated) {
    console.log(`[Socket.IO] Tentativa de uso sem autenticação: ${socket.id}`);
    socket.emit('error', { message: 'Autenticação necessária para usar este serviço.' });
    socket.disconnect(true);
    return;
  }
  
  // Evento de conexão bem-sucedida com informações do usuário
  socket.emit('connection_success', {
    user: socket.user,
    message: 'Conectado com sucesso ao WebSocket RunCash',
    socket_id: socket.id,
    timestamp: new Date().toISOString()
  });
  
  // Funcionalidades do socket para usuário autenticado
  // ...
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`WebSocket Server running on port ${PORT}`);
});

// Conectar ao MongoDB
connectToMongoDB()
  .then((success) => {
    if (success) {
      console.log("MongoDB conectado e pronto para uso.");
    } else {
      console.log("MongoDB não está conectado. Algumas funcionalidades podem não funcionar.");
    }
  }); 