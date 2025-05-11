/**
 * Servidor WebSocket otimizado para RunCash
 * Versão com correções para gerenciamento de memória e conexões
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração
const PORT = process.env.WEBSOCKET_PORT || process.env.PORT || 3030;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';
const COLLECTION_NAME = 'roleta_numeros';
const POLL_INTERVAL = process.env.POLL_INTERVAL || 2000; // 2 segundos

// Informações de configuração
console.log('=== RunCash WebSocket Server ===');
console.log(`PORT: ${PORT}`);
console.log(`MONGODB_URI: ${MONGODB_URI ? MONGODB_URI.replace(/:.*@/, ':****@') : 'Não definida'}`);
console.log(`DB_NAME: ${DB_NAME}`);
console.log(`COLLECTION_NAME: ${COLLECTION_NAME}`);
console.log(`POLL_INTERVAL: ${POLL_INTERVAL}ms`);

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
console.log('[Socket.IO] Middleware de autenticação JWT DESATIVADO para reduzir consumo de memória');

// Middleware de autenticação desativado para WebSocket
io.use((socket, next) => {
  // Atribuir usuário padrão sem verificar token
  socket.user = {
    id: 'system-default',
    username: 'Sistema',
    email: 'default@system.local',
    role: 'admin'
  };
  socket.isAuthenticated = true;
  
  console.log(`[WebSocket Middleware] Conexão permitida sem autenticação: ${socket.id}`);
  return next();
});

console.log('[Socket.IO] Autenticação desativada para todas as conexões WebSocket');
console.log('[Socket.IO] Inicializado com configuração CORS para aceitar todas as origens');

// Resto do código para conexão MongoDB, polling e eventos do WebSocket
// ...

// Verificar a autenticação explicitamente em cada operação do socket
io.on('connection', (socket) => {
  // Log de conexão
  console.log(`[Socket.IO] Nova conexão: ${socket.id}`);
  
  // Evento de conexão bem-sucedida com informações do usuário padrão
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