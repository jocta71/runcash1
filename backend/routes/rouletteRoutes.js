/**
 * Rotas para dados de roletas
 * Implementa diferentes níveis de acesso baseados em assinatura
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

// Importar middlewares
const { verifyTokenAndSubscription, requireResourceAccess } = require('../middlewares/asaasAuthMiddleware');
const { checkSubscription } = require('../middleware/subscriptionCheck');

// Importar controller
const rouletteController = require('../controllers/rouletteController');

// Importar service de banco de dados
const getDb = require('../services/database');

// Configuração do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (agora com acesso público)
 * @access  Público
 */
router.get('/roulettes', 
  async (req, res) => {
    try {
      // Gerar ID de requisição único para rastreamento
      const requestId = crypto.randomUUID();
      
      // Log detalhado do acesso
      console.log(`[API] Acesso público à rota /api/roulettes`);
      console.log(`[API] Request ID: ${requestId}`);
      console.log(`[API] Timestamp: ${new Date().toISOString()}`);
      
      // Definimos o plano como PRO para que todos os usuários tenham um bom nível de acesso
      // mesmo sem autenticação
      req.userPlan = { type: 'PRO' };
      
      // Redirecionar para o controller que lista as roletas
      return rouletteController.listRoulettes(req, res);
    } catch (error) {
      console.error(`[API] Erro ao processar requisição para /api/roulettes:`, error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao processar a requisição',
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route   GET /api/roulettes/:id/basic
 * @desc    Obtém dados básicos de uma roleta específica
 * @access  Público
 */
router.get('/roulettes/:id/basic', 
  rouletteController.getBasicRouletteData
);

/**
 * @route   GET /api/roulettes/:id/recent
 * @desc    Obtém números recentes de uma roleta (limitado por plano)
 * @access  Público com limitações
 */
router.get('/roulettes/:id/recent', 
  // Deixamos sem verificação para acesso público limitado
  (req, res, next) => {
    // Adicionar userPlan como FREE para compatibilidade
    req.userPlan = { type: 'FREE' };
    next();
  },
  rouletteController.getRecentNumbers
);

/**
 * @route   GET /api/roulettes/:id/detailed
 * @desc    Obtém dados detalhados da roleta (agora com acesso público)
 * @access  Público
 */
router.get('/roulettes/:id/detailed', 
  (req, res, next) => {
    // Adicionar userPlan como PRO para compatibilidade
    req.userPlan = { type: 'PRO' };
    
    // Manter compatibilidade com requireResourceAccess
    req.subscription = { 
      id: 'public-access',
      status: 'active'
    };
    
    next();
  },
  requireResourceAccess('standard_stats'),
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (agora com acesso público)
 * @access  Público
 */
router.get('/roulettes/:id/stats', 
  (req, res, next) => {
    // Adicionar userPlan como PRO para compatibilidade
    req.userPlan = { type: 'PRO' };
    
    // Manter compatibilidade com requireResourceAccess
    req.subscription = { 
      id: 'public-access',
      status: 'active'
    };
    
    next();
  },
  requireResourceAccess('standard_stats'),
  rouletteController.getRouletteStatistics
);

/**
 * @route   GET /api/roulettes/:id/historical
 * @desc    Obtém dados históricos avançados (para assinantes premium)
 * @access  Privado - Requer assinatura premium
 */
router.get('/roulettes/7d3c2c9f-2850-f642-861f-5bb4daf1806a/historical', 
  verifyTokenAndSubscription({ 
    required: true,
    allowedPlans: ['PREMIUM']
  }),
  requireResourceAccess('historical_data'),
  rouletteController.getHistoricalData
);

/**
 * @route   GET /api/roulettes/:id/batch
 * @desc    Obtém lote de números (últimos 1000) - requer assinatura
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/batch', 
  checkSubscription,
  (req, res, next) => {
    // Adicionar userPlan como PRO para compatibilidade
    req.userPlan = { type: 'PRO' };
    
    // Manter compatibilidade com requireResourceAccess
    req.subscription = { 
      id: 'local-subscription',
      status: 'active'
    };
    
    next();
  },
  requireResourceAccess('standard_stats'),
  rouletteController.getNumbersBatch
);

/**
 * @route   GET /api/roulettes/:id/preview
 * @desc    Versão degradada para usuários sem assinatura
 * @access  Público
 */
router.get('/roulettes/:id/preview', 
  rouletteController.getFreePreview
);

/**
 * @route   GET /api/roulettes/stream
 * @desc    Streaming SSE para atualizações em tempo real de todas as roletas (acesso público)
 * @access  Público
 */
router.get('/roulettes/stream', async (req, res) => {
  // Configurar cabeçalhos para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Função para enviar um evento para o cliente
  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: ${data}\n\n`);
  };
  
  // Gerar ID de conexão único
  const connectionId = crypto.randomUUID();
  console.log(`[SSE] Nova conexão: ${connectionId}`);
  
  // Enviar evento inicial
  sendEvent('connected', JSON.stringify({ 
    message: 'Conexão estabelecida', 
    connectionId: connectionId,
    timestamp: new Date().toISOString()
  }));
  
  // Registrar cliente no sistema de SSE global
  if (!global.sseClients) {
    global.sseClients = new Map();
  }
  
  global.sseClients.set(connectionId, {
    send: sendEvent,
    timestamp: Date.now()
  });
  
  // Enviar dados iniciais de todas as roletas
  try {
    // Buscar todas as roletas ativas
    const db = await getDb();
    const roulettes = await db.collection('roulettes')
      .find({ status: 'active' })
      .toArray();
    
    if (roulettes && roulettes.length > 0) {
      // Para cada roleta, buscar o último número
      const roulettesWithLatestNumbers = await Promise.all(
        roulettes.map(async (roulette) => {
          // Buscar último número da roleta
          const latestNumber = await db.collection('roulette_numbers')
            .find({ rouletteId: roulette._id.toString() })
            .sort({ timestamp: -1 })
            .limit(1)
            .toArray();
          
          // Retornar objeto com dados da roleta e último número
          return {
            id: roulette._id.toString(),
            name: roulette.name,
            provider: roulette.provider,
            number: latestNumber.length > 0 ? latestNumber[0].number : null,
            color: latestNumber.length > 0 ? getNumberColor(latestNumber[0].number) : null,
            timestamp: latestNumber.length > 0 ? latestNumber[0].timestamp : new Date()
          };
        })
      );
      
      // Enviar dados iniciais
      const initialData = {
        timestamp: new Date().toISOString(),
        roulettes: roulettesWithLatestNumbers,
        count: roulettesWithLatestNumbers.length
      };
      
      // Importar função de criptografia
      const { encryptData } = require('../utils/sseUtils');
      
      // Enviar dados criptografados
      sendEvent('init', encryptData(initialData));
      console.log(`[SSE] Dados iniciais de ${initialData.count} roletas enviados para cliente ${connectionId}`);
    }
  } catch (error) {
    console.error(`[SSE] Erro ao buscar dados iniciais:`, error);
  }
  
  // Limpar a conexão quando o cliente desconectar
  req.on('close', () => {
    console.log(`[SSE] Conexão fechada: ${connectionId}`);
    if (global.sseClients) {
      global.sseClients.delete(connectionId);
    }
  });
});

/**
 * @route   POST /api/roulettes/:id/send-number
 * @desc    Envia um novo número para uma roleta específica via SSE (teste)
 * @access  Público (para teste, considerar restrição em produção)
 */
router.post('/roulettes/:id/send-number', async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const { number } = req.body;
    
    // Validar dados
    if (number === undefined || isNaN(number) || number < 0 || number > 36) {
      return res.status(400).json({
        success: false,
        message: 'Número inválido. Deve ser um valor entre 0 e 36.'
      });
    }
    
    // Verificar se roleta existe
    const db = await getDb();
    const roulette = await db.collection('roulettes').findOne({
      $or: [
        { _id: ObjectId.isValid(rouletteId) ? new ObjectId(rouletteId) : null },
        { id: rouletteId }
      ]
    });
    
    if (!roulette) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada'
      });
    }
    
    // Adicionar número ao banco de dados
    await db.collection('roulette_numbers').insertOne({
      rouletteId: roulette._id.toString(),
      number: parseInt(number),
      timestamp: new Date()
    });
    
    // Enviar atualização via SSE
    await rouletteController.sendRouletteNumberUpdate(rouletteId, parseInt(number));
    
    return res.json({
      success: true,
      message: 'Número enviado com sucesso',
      data: {
        rouletteId: rouletteId,
        number: parseInt(number),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao enviar número:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar requisição',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/roulettes/broadcast-all
 * @desc    Transmite atualizações de todas as roletas via SSE
 * @access  Público (para teste, considerar restrição em produção)
 */
router.post('/roulettes/broadcast-all', async (req, res) => {
  try {
    // Enviar atualizações de todas as roletas
    const success = await rouletteController.sendAllRoulettesUpdate();
    
    if (success) {
      return res.json({
        success: true,
        message: 'Atualizações de todas as roletas enviadas com sucesso',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Erro ao enviar atualizações de roletas',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Erro ao processar broadcast de roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar requisição',
      error: error.message
    });
  }
});

/**
 * Determina a cor de um número da roleta
 * @param {Number} number - Número da roleta
 * @returns {String} - Cor do número (vermelho, preto ou verde)
 */
function getNumberColor(number) {
  if (number === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number) ? 'vermelho' : 'preto';
}

module.exports = router; 