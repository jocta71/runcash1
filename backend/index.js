// Arquivo de entrada unificado para o Railway (Versão Simplificada)
// Configurado para inicialização rápida sem operações complexas

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

// Configuração básica
const PORT = process.env.PORT || 5000;
console.log(`Iniciando servidor na porta ${PORT}`);

// Inicializar Express para a API principal
const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Rota básica para health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RunCash Unified Server',
    timestamp: new Date().toISOString()
  });
});

// Tenta carregar a API, mas continua mesmo se falhar
try {
  const apiPath = require.resolve('./api/index.js');
  console.log(`API encontrada em ${apiPath}, carregando...`);
  const apiApp = require('./api/index.js');
  app.use('/api', apiApp);
  console.log('API carregada com sucesso');
} catch (err) {
  console.error('Erro ao carregar API, continuando sem ela:', err.message);
  
  // Rota de fallback para /api
  app.get('/api', (req, res) => {
    res.json({
      status: 'error',
      message: 'API não disponível',
      timestamp: new Date().toISOString()
    });
  });
}

// Inicializar servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.IO básico
const io = new Server(server, {
  cors: { origin: '*' }
});

// Conectar o Socket.IO
io.on('connection', (socket) => {
  console.log(`Novo cliente conectado: ${socket.id}`);
});

// Iniciar servidor - NÃO MODIFICAR ESTA PARTE
server.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});