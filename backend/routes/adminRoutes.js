/**
 * Rotas administrativas para gerenciamento do sistema
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Middleware para verificar se o usuário é administrador
function isAdmin(req, res, next) {
  // Verificar se o token JWT está presente
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticação ausente ou inválido'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Verificar o token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar se o usuário é administrador
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso restrito a administradores'
      });
    }
    
    // Adicionar o usuário decodificado à requisição para uso posterior
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token de autenticação inválido ou expirado'
    });
  }
}

/**
 * Rota para sincronizar assinaturas sob demanda
 */
router.post('/sync-subscriptions', isAdmin, async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  
  try {
    // Importar o serviço de sincronização
    const syncService = require('../jobs/syncSubscriptions');
    
    console.log(`[AdminAPI ${requestId}] Sincronização de assinaturas solicitada por ${req.user.email}`);
    
    // Executar a sincronização
    const result = await syncService.syncSubscriptions();
    
    console.log(`[AdminAPI ${requestId}] Sincronização concluída com sucesso`);
    
    // Responder com os resultados
    return res.status(200).json({
      success: true,
      message: 'Sincronização de assinaturas concluída com sucesso',
      requestId,
      result
    });
  } catch (error) {
    console.error(`[AdminAPI ${requestId}] Erro na sincronização:`, error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao sincronizar assinaturas',
      requestId,
      error: error.message
    });
  }
});

/**
 * Rota para visualizar estatísticas de assinaturas
 */
router.get('/subscription-stats', isAdmin, async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  
  try {
    const { MongoClient } = require('mongodb');
    
    // Configuração do MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
    const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    console.log(`[AdminAPI ${requestId}] Consultando estatísticas de assinaturas`);
    
    // Estatísticas da coleção subscriptions
    const subscriptionsStats = {
      total: await db.collection('subscriptions').countDocuments(),
      active: await db.collection('subscriptions').countDocuments({ status: 'active' }),
      pending: await db.collection('subscriptions').countDocuments({ status: 'pending' }),
      inactive: await db.collection('subscriptions').countDocuments({ status: 'inactive' }),
      overdue: await db.collection('subscriptions').countDocuments({ status: 'overdue' })
    };
    
    // Estatísticas da coleção userSubscriptions
    const userSubscriptionsStats = {
      total: await db.collection('userSubscriptions').countDocuments(),
      active: await db.collection('userSubscriptions').countDocuments({ status: 'active' }),
      pending: await db.collection('userSubscriptions').countDocuments({ status: 'pending' }),
      inactive: await db.collection('userSubscriptions').countDocuments({ status: 'inactive' }),
      overdue: await db.collection('userSubscriptions').countDocuments({ status: 'overdue' })
    };
    
    // Calcular potenciais inconsistências
    const inconsistencies = {
      activeCount: subscriptionsStats.active - userSubscriptionsStats.active,
      pendingCount: subscriptionsStats.pending - userSubscriptionsStats.pending,
      inactiveCount: subscriptionsStats.inactive - userSubscriptionsStats.inactive,
      overdueCount: subscriptionsStats.overdue - userSubscriptionsStats.overdue,
      totalCount: subscriptionsStats.total - userSubscriptionsStats.total
    };
    
    await client.close();
    
    return res.status(200).json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      subscriptions: subscriptionsStats,
      userSubscriptions: userSubscriptionsStats,
      inconsistencies
    });
  } catch (error) {
    console.error(`[AdminAPI ${requestId}] Erro ao obter estatísticas:`, error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas de assinaturas',
      requestId,
      error: error.message
    });
  }
});

/**
 * Rota para listar assinaturas inconsistentes
 */
router.get('/subscription-inconsistencies', isAdmin, async (req, res) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  
  try {
    const { MongoClient } = require('mongodb');
    
    // Configuração do MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
    const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'runcash';
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    
    console.log(`[AdminAPI ${requestId}] Buscando inconsistências de assinaturas`);
    
    // Buscar assinaturas ativas em subscriptions
    const activeSubscriptions = await db.collection('subscriptions')
      .find({ status: 'active' })
      .project({ customer_id: 1, subscription_id: 1, status: 1, user_id: 1 })
      .toArray();
    
    // Buscar assinaturas ativas em userSubscriptions
    const activeUserSubscriptions = await db.collection('userSubscriptions')
      .find({ status: 'active' })
      .project({ asaasCustomerId: 1, asaasSubscriptionId: 1, status: 1, userId: 1 })
      .toArray();
    
    // Mapear IDs para verificação rápida
    const userSubsMap = new Map();
    activeUserSubscriptions.forEach(sub => {
      userSubsMap.set(sub.asaasCustomerId, sub);
    });
    
    // Identificar assinaturas ativas em subscriptions mas ausentes ou inativas em userSubscriptions
    const missingInUserSubs = [];
    for (const sub of activeSubscriptions) {
      const userSub = userSubsMap.get(sub.customer_id);
      if (!userSub) {
        missingInUserSubs.push(sub);
      }
    }
    
    // Identificar assinaturas ativas em userSubscriptions mas ausentes ou inativas em subscriptions
    const subsMap = new Map();
    activeSubscriptions.forEach(sub => {
      subsMap.set(sub.customer_id, sub);
    });
    
    const missingInSubs = [];
    for (const userSub of activeUserSubscriptions) {
      const sub = subsMap.get(userSub.asaasCustomerId);
      if (!sub) {
        missingInSubs.push(userSub);
      }
    }
    
    await client.close();
    
    return res.status(200).json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      missingInUserSubscriptions: {
        count: missingInUserSubs.length,
        items: missingInUserSubs
      },
      missingInSubscriptions: {
        count: missingInSubs.length,
        items: missingInSubs
      }
    });
  } catch (error) {
    console.error(`[AdminAPI ${requestId}] Erro ao buscar inconsistências:`, error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar inconsistências de assinaturas',
      requestId,
      error: error.message
    });
  }
});

module.exports = router; 