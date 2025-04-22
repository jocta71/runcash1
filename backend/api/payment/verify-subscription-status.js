const axios = require('axios');
const { MongoClient } = require('mongodb');

// Configuração
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_URL = ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

// Cache com TTL para evitar chamadas repetidas à API
const subscriptionStatusCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em milissegundos
const MAX_CACHE_SIZE = 500; // Limitar tamanho do cache

/**
 * Middleware para verificar o status da assinatura em tempo real com a API do Asaas
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 * @param {Function} next - Função next do Express
 */
module.exports = async (req, res, next) => {
  // Se não tiver usuário autenticado, negar acesso
  if (!req.user || !req.user.id) {
    return res.status(401).json({ 
      success: false, 
      error: 'Autenticação necessária'
    });
  }
  
  // Obter o ID da assinatura do usuário
  let subscriptionId;
  
  try {
    const userId = req.user.id;
    
    // Verificar se temos o ID no cache para evitar chamada ao banco de dados
    const cacheKey = `user_subscription_${userId}`;
    
    if (subscriptionStatusCache.has(cacheKey)) {
      const cached = subscriptionStatusCache.get(cacheKey);
      
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        // Se o status for válido, permitir acesso
        if (cached.status === 'active' || cached.status === 'ACTIVE') {
          req.subscription = cached;
          return next();
        } else {
          // Se o status não for ativo, negar acesso
          return res.status(403).json({
            success: false,
            error: 'Assinatura inativa',
            status: cached.status,
            message: 'Sua assinatura não está ativa. Por favor, verifique o status do pagamento.'
          });
        }
      }
      // Se o cache expirou, continuar e renovar
    }
    
    // Conectar ao MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Buscar a assinatura do usuário no banco de dados
    const subscription = await db.collection('subscriptions')
      .findOne({ 
        user_id: userId,
        status: { $nin: ['canceled', 'CANCELED'] } // Excluir assinaturas canceladas
      }, {
        sort: { created_at: -1 } // Pegar a mais recente
      });
    
    // Fechar conexão com o MongoDB
    await client.close();
    
    if (!subscription) {
      // Guardar no cache que o usuário não tem assinatura
      maintainCacheSize();
      subscriptionStatusCache.set(cacheKey, {
        status: 'none',
        timestamp: Date.now(),
        userId
      });
      
      return res.status(403).json({
        success: false,
        error: 'Assinatura não encontrada',
        message: 'Você não possui uma assinatura ativa.'
      });
    }
    
    subscriptionId = subscription.subscription_id || subscription.payment_id;
    
    // Se a assinatura não for 'active', verificar com a API do Asaas
    if (subscription.status.toLowerCase() !== 'active' && 
        subscription.status.toLowerCase() !== 'pending') {
      // Guardar no cache para evitar chamadas desnecessárias
      maintainCacheSize();
      subscriptionStatusCache.set(cacheKey, {
        status: subscription.status,
        timestamp: Date.now(),
        userId,
        subscriptionId
      });
      
      return res.status(403).json({
        success: false,
        error: 'Assinatura inativa',
        status: subscription.status,
        message: 'Sua assinatura não está ativa. Por favor, entre em contato com o suporte.'
      });
    }
    
    // Se o status for pending, verificar com a API se o pagamento foi confirmado
    if (subscription.status.toLowerCase() === 'pending') {
      const realStatus = await verifyWithAsaasApi(subscriptionId);
      
      // Guardar no cache
      maintainCacheSize();
      subscriptionStatusCache.set(cacheKey, {
        status: realStatus.status,
        timestamp: Date.now(),
        userId,
        subscriptionId,
        verified: true,
        ...realStatus
      });
      
      // Atualizar banco de dados se o status for diferente
      if (realStatus.status !== subscription.status) {
        await updateSubscriptionInDb(userId, subscriptionId, realStatus.status, realStatus);
      }
      
      // Se o status real não for ativo, negar acesso
      if (realStatus.status.toLowerCase() !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Assinatura não confirmada',
          status: realStatus.status,
          message: 'Seu pagamento ainda não foi confirmado. Por favor, verifique o status do pagamento.'
        });
      }
    } else {
      // Se for active, ainda verificar periodicamente com a API
      // Mas não a cada requisição - apenas se o cache estiver expirado
      const cachedStatus = subscriptionStatusCache.get(cacheKey);
      if (!cachedStatus || Date.now() - cachedStatus.timestamp > CACHE_TTL) {
        // Verificar com a API em segundo plano para não atrasar a resposta
        setTimeout(async () => {
          try {
            const realStatus = await verifyWithAsaasApi(subscriptionId);
            
            // Guardar no cache
            maintainCacheSize();
            subscriptionStatusCache.set(cacheKey, {
              status: realStatus.status,
              timestamp: Date.now(),
              userId,
              subscriptionId,
              verified: true,
              ...realStatus
            });
            
            // Atualizar banco de dados se o status for diferente
            if (realStatus.status !== subscription.status) {
              await updateSubscriptionInDb(userId, subscriptionId, realStatus.status, realStatus);
            }
          } catch (error) {
            console.error(`[VERIFY_SUBSCRIPTION] Erro ao verificar status da assinatura em segundo plano: ${error.message}`);
          }
        }, 0);
      }
      
      // Guardar no cache se ainda não existir
      if (!cachedStatus) {
        maintainCacheSize();
        subscriptionStatusCache.set(cacheKey, {
          status: subscription.status,
          timestamp: Date.now(),
          userId,
          subscriptionId
        });
      }
    }
    
    // Adicionar informações da assinatura ao request para uso posterior
    req.subscription = {
      id: subscriptionId,
      status: subscription.status,
      userId
    };
    
    // Permitir acesso
    return next();
  } catch (error) {
    console.error(`[VERIFY_SUBSCRIPTION] Erro ao verificar assinatura: ${error.message}`);
    
    // Em caso de erro, por segurança, negar acesso
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar assinatura',
      message: 'Ocorreu um erro ao verificar o status da sua assinatura. Por favor, tente novamente mais tarde.'
    });
  }
};

/**
 * Função para verificar o status da assinatura diretamente na API do Asaas
 * @param {string} subscriptionId - ID da assinatura no Asaas
 * @returns {Object} - Objeto com status e detalhes da assinatura
 */
async function verifyWithAsaasApi(subscriptionId) {
  try {
    // Verificar se a chave de API está configurada
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    if (!ASAAS_API_KEY) {
      throw new Error('Chave de API do Asaas não configurada');
    }
    
    // Configurar cliente HTTP
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Obter dados da assinatura
    const subscriptionResponse = await apiClient.get(`/subscriptions/${subscriptionId}`);
    const subscription = subscriptionResponse.data;
    
    // Se a API retornar erro, considerar como inativa
    if (!subscription || subscription.errors) {
      console.error(`[VERIFY_SUBSCRIPTION] Erro na resposta da API: ${JSON.stringify(subscription)}`);
      return { status: 'error', details: subscription };
    }
    
    // Verificar se a assinatura está ativa
    if (subscription.status !== 'ACTIVE') {
      return { status: subscription.status, details: subscription };
    }
    
    // Verificar pagamento mais recente
    const paymentsResponse = await apiClient.get('/payments', {
      params: { subscription: subscriptionId, limit: 1, offset: 0 }
    });
    
    if (!paymentsResponse.data || !paymentsResponse.data.data || paymentsResponse.data.data.length === 0) {
      return { status: 'PENDING_PAYMENT', details: subscription };
    }
    
    const lastPayment = paymentsResponse.data.data[0];
    
    // Se o último pagamento estiver pendente, considerar assinatura como pendente
    if (lastPayment.status === 'PENDING') {
      return { status: 'PENDING', details: subscription, payment: lastPayment };
    }
    
    // Se o último pagamento for confirmado, considerar ativa
    if (['CONFIRMED', 'RECEIVED'].includes(lastPayment.status)) {
      return { status: 'ACTIVE', details: subscription, payment: lastPayment };
    }
    
    // Outro status de pagamento
    return { status: lastPayment.status, details: subscription, payment: lastPayment };
  } catch (error) {
    console.error(`[VERIFY_SUBSCRIPTION] Erro ao verificar com API do Asaas: ${error.message}`);
    // Se houver um erro de comunicação, retornar erro
    return { status: 'ERROR', error: error.message };
  }
}

/**
 * Atualiza o status da assinatura no banco de dados
 */
async function updateSubscriptionInDb(userId, subscriptionId, status, details) {
  try {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'runcash');
    
    // Criar entrada de auditoria
    await db.collection('subscription_audit').insertOne({
      subscription_id: subscriptionId,
      user_id: userId,
      previous_status: null, // Não temos o status anterior aqui
      new_status: status,
      changed_by: 'verify_middleware',
      details,
      timestamp: new Date()
    });
    
    // Atualizar assinatura
    await db.collection('subscriptions').updateOne(
      { subscription_id: subscriptionId },
      { 
        $set: { 
          status,
          updated_at: new Date(),
          verified_at: new Date()
        },
        $push: {
          status_history: {
            status,
            timestamp: new Date(),
            source: 'verify_middleware',
            details: {
              message: 'Verificação em tempo real com API do Asaas'
            }
          }
        }
      }
    );
    
    await client.close();
    console.log(`[VERIFY_SUBSCRIPTION] Status da assinatura ${subscriptionId} atualizado para ${status}`);
  } catch (error) {
    console.error(`[VERIFY_SUBSCRIPTION] Erro ao atualizar banco de dados: ${error.message}`);
  }
}

/**
 * Mantém o tamanho do cache sob controle
 */
function maintainCacheSize() {
  if (subscriptionStatusCache.size >= MAX_CACHE_SIZE) {
    // Encontrar a entrada mais antiga
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of subscriptionStatusCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    // Remover a entrada mais antiga
    if (oldestKey) {
      subscriptionStatusCache.delete(oldestKey);
    }
  }
} 