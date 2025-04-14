/**
 * Utilitários para integração com o Asaas
 */

const crypto = require('crypto');

/**
 * Verifica se uma requisição de webhook é válida e vem do Asaas
 * 
 * @param {Object} req - Objeto de requisição Express
 * @returns {Boolean} - Se a requisição é válida
 */
function verifyAsaasRequest(req) {
  // Se estivermos em ambiente de desenvolvimento, permitimos todas as requisições
  if (process.env.NODE_ENV === 'development' && !process.env.VERIFY_WEBHOOKS_DEV) {
    return true;
  }

  try {
    // Verificar se temos um segredo configurado
    if (!process.env.ASAAS_WEBHOOK_SECRET) {
      console.warn('ASAAS_WEBHOOK_SECRET não configurado. Prosseguindo sem verificação.');
      return true;
    }

    // Verificar headers específicos do Asaas
    // Método de verificação do Asaas (pode variar conforme documentação)
    const signature = req.headers['asaas-signature'] || '';
    const payload = JSON.stringify(req.body);
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.ASAAS_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    // Verificar se a assinatura corresponde
    if (signature === expectedSignature) {
      return true;
    }
    
    console.error('Assinatura do webhook inválida');
    return false;
  } catch (error) {
    console.error('Erro ao verificar requisição do Asaas:', error);
    return false;
  }
}

/**
 * Constrói uma URL para a API do Asaas
 * 
 * @param {String} path - Caminho da API
 * @returns {String} - URL completa
 */
function getAsaasApiUrl(path) {
  // Determinar a URL base com base no ambiente
  const isProduction = process.env.ASAAS_ENVIRONMENT === 'production';
  const baseUrl = isProduction 
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';
    
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Constrói os cabeçalhos para requisições à API do Asaas
 * 
 * @returns {Object} - Cabeçalhos HTTP
 */
function getAsaasApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'access_token': process.env.ASAAS_API_KEY
  };
}

/**
 * Extrai o ID do usuário de uma referência externa
 * 
 * @param {String} externalReference - Referência externa (ex: "userId:123456")
 * @returns {String|null} - ID do usuário extraído ou null
 */
function extractUserIdFromReference(externalReference) {
  if (!externalReference) return null;
  
  // Se já for apenas o ID, retornar como está
  if (!externalReference.includes(':')) return externalReference;
  
  // Formato esperado: userId:123456
  const parts = externalReference.split(':');
  return parts.length > 1 ? parts[1] : null;
}

/**
 * Determina o tipo de plano com base na descrição
 * 
 * @param {String} description - Descrição do plano
 * @returns {String} - Tipo do plano (basic, pro, free)
 */
function determinePlanType(description) {
  if (!description) return 'basic';
  
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes('pro') || lowerDesc.includes('profissional')) {
    return 'pro';
  } else if (lowerDesc.includes('premium')) {
    return 'premium';
  } else if (lowerDesc.includes('free') || lowerDesc.includes('grátis') || lowerDesc.includes('gratis')) {
    return 'free';
  } else {
    return 'basic';
  }
}

/**
 * Determina o status de assinatura com base no evento do Asaas
 * 
 * @param {String} eventType - Tipo de evento do Asaas
 * @returns {String} - Status de assinatura (active, overdue, canceled, etc)
 */
function determineSubscriptionStatus(eventType) {
  switch (eventType) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
    case 'SUBSCRIPTION_CREATED':
    case 'SUBSCRIPTION_UPDATED':
    case 'SUBSCRIPTION_ACTIVATED':
      return 'active';
    case 'PAYMENT_OVERDUE':
      return 'overdue';
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_DELETED':
    case 'PAYMENT_CHARGEBACK':
    case 'SUBSCRIPTION_INACTIVATED':
    case 'SUBSCRIPTION_DELETED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

// Exportar funções
module.exports = {
  verifyAsaasRequest,
  getAsaasApiUrl,
  getAsaasApiHeaders,
  extractUserIdFromReference,
  determinePlanType,
  determineSubscriptionStatus
}; 