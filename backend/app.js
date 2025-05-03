const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

// Instanciar o aplicativo Express
const app = express();

// Middleware para bloquear solicitações à rota /api/roulettes
app.use((req, res, next) => {
  // Verificar se a requisição é para a rota /api/roulettes
  if (req.path.toLowerCase() === '/api/roulettes' || req.path.toLowerCase() === '/api/roulettes/') {
    // Gerar ID de requisição único para rastreamento
    const requestId = crypto.randomUUID();
    
    // Log detalhado do bloqueio
    console.log(`[FIREWALL] Bloqueando acesso à rota desativada: ${req.path}`);
    console.log(`[FIREWALL] Request ID: ${requestId}`);
    console.log(`[FIREWALL] Method: ${req.method}`);
    console.log(`[FIREWALL] Headers: ${JSON.stringify(req.headers)}`);
    console.log(`[FIREWALL] IP: ${req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'}`);
    console.log(`[FIREWALL] User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
    console.log(`[FIREWALL] Timestamp: ${new Date().toISOString()}`);
    
    // Configurar cabeçalhos CORS para a resposta
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Responder com 403 Forbidden
    return res.status(403).json({
      success: false,
      message: 'Esta rota foi desativada por razões de segurança.',
      code: 'ROUTE_DISABLED',
      requestId: requestId,
      alternativeEndpoints: ['/api/roletas', '/api/ROULETTES'],
      timestamp: new Date().toISOString()
    });
  }
  
  // Se não for a rota bloqueada, continuar para o próximo middleware
  next();
});

// Configurar middleware CORS
app.use(cors());

// Configurar middleware para processar JSON
app.use(express.json());

// Configurar middleware para dados de formulário
app.use(express.urlencoded({ extended: true }));

// ... existing code ... 