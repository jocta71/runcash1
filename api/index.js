const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const verificarAssinaturaRoletas = require('../middleware/verificarAssinaturaRoletas');

// Inicializar o router da API
const apiApp = express.Router();

// Configurar middleware
apiApp.use(express.json());
apiApp.use(cors({
  origin: ['https://runcashh11.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

// Definir o modelo de Roulette
const RouletteSchema = new mongoose.Schema({
  name: String,
  provider: String,
  type: String,
  numbers: [Number],
  lastUpdate: Date,
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Roulette = mongoose.model('Roulette', RouletteSchema);

// Aplicar o middleware de verificação de assinatura para todas as rotas
apiApp.use(verificarAssinaturaRoletas);

// Rota de verificação de saúde do sistema
apiApp.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint de autenticação
apiApp.post('/auth/login', (req, res) => {
  // Implementação simplificada - seria substituída pela autenticação real
  const { email, password } = req.body;
  
  if (email && password) {
    const token = jwt.sign(
      { email, id: 'user123', asaasCustomerId: 'cus_000006666972' },
      process.env.JWT_SECRET || 'secret_padrao_roleta',
      { expiresIn: '7d' }
    );
    
    return res.json({ token, user: { email, id: 'user123' } });
  }
  
  return res.status(401).json({ error: 'Credenciais inválidas' });
});

// API para verificar status da assinatura
apiApp.get('/subscription/status', (req, res) => {
  // Mock de status de assinatura
  return res.json({
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString()
  });
});

// Endpoint para verificar autenticação atual
apiApp.get('/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_padrao_roleta');
    
    return res.json({
      user: {
        id: decoded.id || 'user123',
        email: decoded.email,
        asaasCustomerId: decoded.asaasCustomerId
      }
    });
  } catch (error) {
    console.error('[Auth] Erro ao verificar token:', error);
    return res.status(401).json({ error: 'Token inválido' });
  }
});

// Modificar o endpoint de ROULETTES para verificar o nível de acesso
apiApp.get('/ROULETTES', async (req, res) => {
  try {
    // Obter parâmetros da requisição
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    
    // Verificar se o usuário tem acesso premium
    const isPremiumUser = req.isPremiumUser === true;
    
    // Aplicar limite baseado no nível de acesso
    const accessLimit = isPremiumUser ? limit : Math.min(limit, 20);
    
    // Consultar roletas no banco de dados com o limite aplicado
    const roletas = await Roulette.find()
      .sort({ updatedAt: -1 })
      .limit(accessLimit)
      .skip(skip);
    
    // Retornar os dados com metadados sobre o acesso
    return res.json({
      data: roletas,
      meta: {
        isPremiumAccess: isPremiumUser,
        limit: accessLimit,
        totalReturned: roletas.length,
        message: isPremiumUser ? 
          'Acesso premium ativo' : 
          'Acesso limitado. Ative o plano premium para dados completos'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar roletas:', error);
    return res.status(500).json({ error: 'Erro interno ao buscar dados de roletas' });
  }
});

module.exports = apiApp; 