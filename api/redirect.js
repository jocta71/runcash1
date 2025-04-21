/**
 * Função serverless para gerenciar redirecionamentos após pagamentos
 * Centraliza lógica de redirecionamento após eventos de pagamento
 */

const utils = require('./config/utils');

// Função principal (entry point serverless)
module.exports = async (req, res) => {
  // Configurar CORS
  utils.setCorsHeaders(res);
  
  // Tratar requisição OPTIONS (preflight)
  if (utils.handleOptions(req, res)) {
    return;
  }
  
  // Validar método HTTP permitido
  if (!utils.validateMethod(req, res, ['GET'])) {
    return;
  }
  
  try {
    // Identificar o tipo de redirecionamento com base no parâmetro
    const redirectType = req.query.type || 'subscription';
    
    switch (redirectType) {
      case 'subscription':
        return await handleSubscriptionRedirect(req, res);
      case 'payment':
        return await handlePaymentRedirect(req, res);
      case 'canceled':
        return await handleCancellationRedirect(req, res);
      default:
        // Redirecionar para página padrão
        return res.redirect(302, process.env.FRONTEND_URL || '/');
    }
  } catch (error) {
    console.error('Erro na função de redirecionamento:', error);
    
    // Em caso de erro, redirecionar para página de erro
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Ocorreu um erro ao processar sua solicitação')}`);
  }
};

/**
 * Gerencia redirecionamento após criação/atualização de assinatura
 * @param {object} req - Requisição HTTP
 * @param {object} res - Resposta HTTP
 */
async function handleSubscriptionRedirect(req, res) {
  const { token, subscriptionId, status, paymentId } = req.query;
  
  // Validar parâmetros obrigatórios
  if (!subscriptionId || !token) {
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Parâmetros inválidos')}`);
  }
  
  try {
    // Verificar token
    const verification = utils.verifyToken(token);
    
    if (!verification.valid) {
      return res.redirect(302, `${process.env.FRONTEND_URL || ''}/login?expired=true`);
    }
    
    // Conectar ao MongoDB
    const db = await utils.connectToMongoDB();
    const usersCollection = db.collection('users');
    
    // Verificar usuário
    const userId = verification.decoded.userId;
    const user = await usersCollection.findOne({ _id: utils.toObjectId(userId) });
    
    if (!user) {
      return res.redirect(302, `${process.env.FRONTEND_URL || ''}/login?expired=true`);
    }
    
    // Verificar assinatura no Asaas
    const asaas = utils.asaasClient();
    
    try {
      const subscriptionResponse = await asaas.get(`/subscriptions/${subscriptionId}`);
      const subscription = subscriptionResponse.data;
      
      // Verificar se a assinatura pertence ao usuário
      if (subscription.customer !== user.asaasCustomerId) {
        return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Assinatura não pertence ao usuário')}`);
      }
      
      // Registrar status da assinatura no histórico do usuário (opcional)
      await usersCollection.updateOne(
        { _id: utils.toObjectId(userId) },
        { 
          $push: { 
            subscriptionHistory: {
              subscriptionId,
              status: subscription.status,
              billingType: subscription.billingType,
              value: subscription.value,
              timestamp: new Date()
            } 
          },
          $set: {
            lastSubscriptionId: subscriptionId,
            lastSubscriptionStatus: subscription.status,
            updatedAt: new Date()
          }
        }
      );
      
      // Redirecionar para a página correta com base no status
      if (subscription.status === 'ACTIVE') {
        return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/assinatura?status=success&id=${subscriptionId}`);
      } else if (subscription.status === 'PENDING') {
        return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/assinatura?status=pending&id=${subscriptionId}`);
      } else {
        return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/assinatura?status=${subscription.status.toLowerCase()}&id=${subscriptionId}`);
      }
    } catch (asaasError) {
      console.error('Erro ao buscar assinatura no Asaas:', asaasError);
      return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/assinatura?status=error&message=${encodeURIComponent('Erro ao verificar assinatura')}`);
    }
  } catch (error) {
    console.error('Erro ao processar redirecionamento de assinatura:', error);
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Erro interno ao processar redirecionamento')}`);
  }
}

/**
 * Gerencia redirecionamento após processamento de pagamento
 * @param {object} req - Requisição HTTP
 * @param {object} res - Resposta HTTP
 */
async function handlePaymentRedirect(req, res) {
  const { token, paymentId, status } = req.query;
  
  // Validar parâmetros obrigatórios
  if (!paymentId || !token) {
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Parâmetros inválidos')}`);
  }
  
  try {
    // Verificar token
    const verification = utils.verifyToken(token);
    
    if (!verification.valid) {
      return res.redirect(302, `${process.env.FRONTEND_URL || ''}/login?expired=true`);
    }
    
    // Verificar pagamento no Asaas
    const asaas = utils.asaasClient();
    
    try {
      const paymentResponse = await asaas.get(`/payments/${paymentId}`);
      const payment = paymentResponse.data;
      
      // Verificar se o pagamento está vinculado a uma assinatura
      if (payment.subscription) {
        // Redirecionar para o fluxo de assinatura com o payment ID
        return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/assinatura?status=${payment.status.toLowerCase()}&paymentId=${paymentId}&subscriptionId=${payment.subscription}`);
      } else {
        // Pagamento avulso
        return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/pagamentos?status=${payment.status.toLowerCase()}&id=${paymentId}`);
      }
    } catch (asaasError) {
      console.error('Erro ao buscar pagamento no Asaas:', asaasError);
      return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/pagamentos?status=error&message=${encodeURIComponent('Erro ao verificar pagamento')}`);
    }
  } catch (error) {
    console.error('Erro ao processar redirecionamento de pagamento:', error);
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Erro interno ao processar redirecionamento')}`);
  }
}

/**
 * Gerencia redirecionamento após cancelamento de assinatura
 * @param {object} req - Requisição HTTP
 * @param {object} res - Resposta HTTP
 */
async function handleCancellationRedirect(req, res) {
  const { token, subscriptionId, status } = req.query;
  
  // Validar parâmetros obrigatórios
  if (!subscriptionId || !token) {
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Parâmetros inválidos')}`);
  }
  
  try {
    // Verificar token
    const verification = utils.verifyToken(token);
    
    if (!verification.valid) {
      return res.redirect(302, `${process.env.FRONTEND_URL || ''}/login?expired=true`);
    }
    
    // Redirecionar para a página de assinatura com mensagem de cancelamento
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/minha-conta/assinatura?status=canceled&id=${subscriptionId}&message=${encodeURIComponent('Assinatura cancelada com sucesso')}`);
  } catch (error) {
    console.error('Erro ao processar redirecionamento de cancelamento:', error);
    return res.redirect(302, `${process.env.FRONTEND_URL || ''}/erro?message=${encodeURIComponent('Erro interno ao processar redirecionamento')}`);
  }
} 