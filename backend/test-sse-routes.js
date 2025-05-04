/**
 * Arquivo de teste para as rotas SSE
 * Execute com: node test-sse-routes.js
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5001;

// Middleware básico
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));

// Middleware de autenticação mock
app.use((req, res, next) => {
  // Para teste, aceitamos qualquer token ou até sem token
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    console.log(`[TEST] Token recebido: ${token.substring(0, 15)}...`);
    
    // Simular usuário autenticado
    req.user = {
      id: '123456',
      email: 'test@example.com'
    };
  } else {
    // Para teste, permitimos até sem token
    console.log('[TEST] Sem token de autenticação');
    req.user = {
      id: 'guest',
      email: 'guest@example.com'
    };
  }
  
  next();
});

// Middleware de verificação de assinatura mock
const checkSubscription = (req, res, next) => {
  console.log(`[TEST] Verificando assinatura para usuário ${req.user.id}`);
  // Para teste, sempre permitir
  next();
};

// Rota para servir a página HTML de teste
app.get('/test-page', (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'test-sse-client.html');
    
    if (fs.existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.status(404).send('Arquivo HTML de teste não encontrado');
    }
  } catch (error) {
    console.error('[TEST] Erro ao servir página de teste:', error);
    res.status(500).send('Erro interno do servidor ao tentar carregar a página de teste');
  }
});

// Rota de teste raiz
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'SSE Test Server',
    timestamp: new Date().toISOString(),
    links: {
      testPage: '/test-page',
      allRoulettes: '/api/stream/roulettes',
      oneRoulette: '/api/stream/roulettes/1'
    }
  });
});

// Rota SSE para todas as roletas
app.get('/api/stream/roulettes', checkSubscription, (req, res) => {
  // ID do request para acompanhamento nos logs
  const requestId = crypto.randomUUID();
  
  console.log(`[TEST-SSE] Nova conexão para todas as roletas`);
  console.log(`[TEST-SSE] URL: ${req.originalUrl}`);
  console.log(`[TEST-SSE] Path: ${req.path}`);
  console.log(`[TEST-SSE] Request ID: ${requestId}`);
  console.log(`[TEST-SSE] Usuário: ${req.user.id}`);

  // Configurar cabeçalhos SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive'
  });

  // Enviar evento inicial com algumas roletas de teste
  const initialData = {
    type: 'initial',
    roulettes: [
      { id: '1', name: 'Roleta Teste 1', lastNumbers: [1, 2, 3, 4, 5] },
      { id: '2', name: 'Roleta Teste 2', lastNumbers: [10, 20, 30, 40, 50] }
    ],
    timestamp: new Date().toISOString()
  };
  
  // Enviar como texto plano para depuração
  res.write(`event: update\n`);
  res.write(`id: ${Date.now()}\n`);
  res.write(`data: ${JSON.stringify(initialData)}\n\n`);
  
  // Simular atualizações a cada 5 segundos
  const interval = setInterval(() => {
    const updateData = {
      type: 'update',
      roulettes: [
        { 
          id: '1', 
          name: 'Roleta Teste 1', 
          lastNumbers: [Math.floor(Math.random() * 36), Math.floor(Math.random() * 36)] 
        },
        { 
          id: '2', 
          name: 'Roleta Teste 2', 
          lastNumbers: [Math.floor(Math.random() * 36), Math.floor(Math.random() * 36)] 
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    console.log(`[TEST-SSE] Enviando atualização para ${requestId}`);
    res.write(`event: update\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: ${JSON.stringify(updateData)}\n\n`);
  }, 5000);
  
  // Heartbeat a cada 30 segundos
  const heartbeatInterval = setInterval(() => {
    console.log(`[TEST-SSE] Enviando heartbeat para ${requestId}`);
    res.write(`event: heartbeat\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: {"timestamp": "${new Date().toISOString()}"}\n\n`);
  }, 30000);
  
  // Limpar recursos quando a conexão for fechada
  req.on('close', () => {
    console.log(`[TEST-SSE] Conexão fechada para ${requestId}`);
    clearInterval(interval);
    clearInterval(heartbeatInterval);
  });
});

// Rota SSE para roleta específica
app.get('/api/stream/roulettes/:id', checkSubscription, (req, res) => {
  const requestId = crypto.randomUUID();
  const rouletteId = req.params.id;
  
  console.log(`[TEST-SSE] Nova conexão para roleta ID: ${rouletteId}`);
  console.log(`[TEST-SSE] URL: ${req.originalUrl}`);
  console.log(`[TEST-SSE] Path: ${req.path}`);
  console.log(`[TEST-SSE] Request ID: ${requestId}`);
  console.log(`[TEST-SSE] Usuário: ${req.user.id}`);

  // Configurar cabeçalhos SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive'
  });

  // Enviar evento inicial com dados da roleta de teste
  const initialData = {
    type: 'initial',
    roulette: { 
      id: rouletteId, 
      name: `Roleta Teste ${rouletteId}`, 
      lastNumbers: [1, 2, 3, 4, 5] 
    },
    timestamp: new Date().toISOString()
  };
  
  res.write(`event: update\n`);
  res.write(`id: ${Date.now()}\n`);
  res.write(`data: ${JSON.stringify(initialData)}\n\n`);
  
  // Simular atualizações a cada 5 segundos
  const interval = setInterval(() => {
    const updateData = {
      type: 'update',
      roulette: { 
        id: rouletteId, 
        name: `Roleta Teste ${rouletteId}`, 
        lastNumbers: [Math.floor(Math.random() * 36), Math.floor(Math.random() * 36)] 
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`[TEST-SSE] Enviando atualização para ${requestId}`);
    res.write(`event: update\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: ${JSON.stringify(updateData)}\n\n`);
  }, 5000);
  
  // Heartbeat a cada 30 segundos
  const heartbeatInterval = setInterval(() => {
    console.log(`[TEST-SSE] Enviando heartbeat para ${requestId}`);
    res.write(`event: heartbeat\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: {"timestamp": "${new Date().toISOString()}"}\n\n`);
  }, 30000);
  
  // Limpar recursos quando a conexão for fechada
  req.on('close', () => {
    console.log(`[TEST-SSE] Conexão fechada para ${requestId}`);
    clearInterval(interval);
    clearInterval(heartbeatInterval);
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`[TEST] Servidor de teste SSE rodando na porta ${PORT}`);
  console.log(`[TEST] Acesse http://localhost:${PORT}/`);
  console.log(`[TEST] Endpoint SSE: http://localhost:${PORT}/api/stream/roulettes`);
});