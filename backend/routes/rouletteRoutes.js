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

// Configuração do MongoDB
const url = process.env.MONGODB_URI || 'mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash';
const dbName = process.env.MONGODB_DB_NAME || 'runcash';

/**
 * @route   GET /api/roulettes
 * @desc    Lista todas as roletas disponíveis (requer assinatura ativa)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes', 
  async (req, res, next) => {
    // Antes de verificar a assinatura, vamos verificar se o usuário tem acesso direto
    // com base no token
    try {
      if (!req.user || !req.user.id) {
        console.log('[API] Tentativa de acesso sem autenticação à rota /api/roulettes');
        return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
      }
      
      // Verificar diretamente na base de dados se o usuário tem acesso
      const client = new MongoClient(url, { useUnifiedTopology: true });
      await client.connect();
      const db = client.db(dbName);
      
      // Buscar usuário e verificar se existe com esse ID
      const userId = req.user.id;
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        await client.close();
        console.log(`[API] Usuário ${userId} não encontrado na base de dados`);
        return res.status(401).json({ success: false, message: 'Usuário não encontrado' });
      }
      
      console.log(`[API] Usuário ${userId} encontrado com email: ${user.email}`);
      
      // Verificar se o usuário tem customerId ou asaasCustomerId
      const customerId = user.customerId || user.asaasCustomerId;
      if (customerId) {
        console.log(`[API] Usuário tem customerId: ${customerId}`);
        
        // Verificar se existe assinatura ativa com esse customerId
        const subscription = await db.collection('userSubscriptions').findOne({
          customerId: customerId,
          status: 'active',
          pendingFirstPayment: false
        });
        
        if (subscription) {
          console.log(`[API] Assinatura ativa encontrada com ID: ${subscription._id}`);
          // Garantir que a assinatura está vinculada ao usuário
          if (!subscription.userId) {
            await db.collection('userSubscriptions').updateOne(
              { _id: subscription._id },
              { $set: { userId: userId } }
            );
            console.log(`[API] Assinatura atualizada com userId: ${userId}`);
          }
          
          // Usuário tem assinatura válida, continuar
          await client.close();
          next();
          return;
        } else {
          console.log(`[API] Não foi encontrada assinatura ativa com customerId: ${customerId}`);
          
          // Verificar todas as assinaturas ativas no sistema
          const activeSubscriptions = await db.collection('userSubscriptions').find({
            status: 'active',
            pendingFirstPayment: false
          }).toArray();
          
          console.log(`[API] Total de assinaturas ativas no sistema: ${activeSubscriptions.length}`);
          
          // Verificar se alguma dessas assinaturas pode ser associada a este usuário
          const matchedSubscription = activeSubscriptions.find(sub => 
            sub.customerId === customerId || 
            sub.userId === userId.toString() || 
            sub.userId === userId
          );
          
          if (matchedSubscription) {
            console.log(`[API] Encontrada assinatura ativa relacionada: ${matchedSubscription._id}`);
            
            // Atualizar a assinatura com o userId correto
            await db.collection('userSubscriptions').updateOne(
              { _id: matchedSubscription._id },
              { $set: { userId: userId } }
            );
            
            // Atualizar o usuário com o customerId correto
            await db.collection('users').updateOne(
              { _id: new ObjectId(userId) },
              { $set: { 
                  customerId: matchedSubscription.customerId,
                  asaasCustomerId: matchedSubscription.customerId
                } 
              }
            );
            
            console.log(`[API] Usuário e assinatura atualizados com sucesso`);
            await client.close();
            next();
            return;
          }
        }
      } else {
        console.log(`[API] Usuário ${userId} não tem customerId ou asaasCustomerId`);
      }
      
      await client.close();
      
      // Passar para o próximo middleware (checkSubscription)
      next();
    } catch (error) {
      console.error(`[API] Erro ao verificar acesso direto: ${error.message}`);
      next();
    }
  },
  checkSubscription,
  async (req, res) => {
    try {
      // Gerar ID de requisição único para rastreamento
      const requestId = crypto.randomUUID();
      
      // Log detalhado do acesso
      console.log(`[API] Acesso autorizado à rota /api/roulettes`);
      console.log(`[API] Request ID: ${requestId}`);
      console.log(`[API] Usuário ID: ${req.user.id}`);
      console.log(`[API] Timestamp: ${new Date().toISOString()}`);
      
      // Adicionar informações de plano para manter compatibilidade
      req.userPlan = { type: 'PRO' }; // Definimos como PRO pois passou pela verificação
      
      // Redirecionar para o controller que lista as roletas
      return rouletteController.listRoulettes(req, res);
    } catch (error) {
      console.error(`[API] Erro ao processar requisição para /api/roulettes:`, error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao processar a requisição',
        requestId: requestId,
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
 * @desc    Obtém dados detalhados da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/detailed', 
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
  rouletteController.getDetailedRouletteData
);

/**
 * @route   GET /api/roulettes/:id/stats
 * @desc    Obtém estatísticas detalhadas da roleta (para assinantes)
 * @access  Privado - Requer assinatura
 */
router.get('/roulettes/:id/stats', 
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

module.exports = router; 