/**
 * Utilitários para integração com o Asaas
 */

import crypto from 'crypto';

// Chaves de API do Asaas (devem ser obtidas de variáveis de ambiente)
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
const ASAAS_WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET;

// URLs base para o Asaas (produção ou sandbox)
const ASAAS_BASE_URL = import.meta.env.VITE_ASAAS_SANDBOX === 'true'
  ? 'https://sandbox.asaas.com'
  : 'https://www.asaas.com';

// IDs dos planos no Asaas
const PLAN_IDS = {
  basic: import.meta.env.VITE_ASAAS_BASIC_PLAN_ID || 'sub_basic',
  pro: import.meta.env.VITE_ASAAS_PRO_PLAN_ID || 'sub_pro'
};

/**
 * Verifica se uma requisição de webhook é válida e vem do Asaas
 * 
 * @param {Object} req - Objeto de requisição Express
 * @returns {Boolean} - Se a requisição é válida
 */
export async function verifyAsaasRequest(req) {
  // Se estivermos em ambiente de desenvolvimento, permitimos todas as requisições
  if (process.env.NODE_ENV === 'development' && !process.env.VERIFY_WEBHOOKS_DEV) {
    return true;
  }

  try {
    // Verificar se temos um segredo configurado
    if (!ASAAS_WEBHOOK_SECRET) {
      console.warn('ASAAS_WEBHOOK_SECRET não configurado. Prosseguindo sem verificação.');
      return true;
    }

    // Verificar headers específicos do Asaas
    // Nota: A documentação específica do Asaas deve ser consultada para
    // determinar o método exato de verificação (Token, HMAC, etc.)
    
    // Exemplo de verificação por HMAC (o método real pode variar):
    const signature = req.headers['asaas-signature'] || '';
    const payload = JSON.stringify(req.body);
    
    const expectedSignature = crypto
      .createHmac('sha256', ASAAS_WEBHOOK_SECRET)
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
export function getAsaasApiUrl(path) {
  return `${ASAAS_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Constrói os cabeçalhos para requisições à API do Asaas
 * 
 * @returns {Object} - Cabeçalhos HTTP
 */
export function getAsaasApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY
  };
}

/**
 * Cria uma assinatura no Asaas
 * 
 * @param {Object} data - Dados da assinatura
 * @returns {Promise<Object>} - Resposta da API
 */
export async function createAsaasSubscription(data) {
  try {
    const response = await fetch(getAsaasApiUrl('/subscriptions'), {
      method: 'POST',
      headers: getAsaasApiHeaders(),
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error);
    throw error;
  }
}

/**
 * Cancela uma assinatura no Asaas
 * 
 * @param {String} subscriptionId - ID da assinatura
 * @returns {Promise<Object>} - Resposta da API
 */
export async function cancelAsaasSubscription(subscriptionId) {
  try {
    const response = await fetch(getAsaasApiUrl(`/subscriptions/${subscriptionId}/cancel`), {
      method: 'POST',
      headers: getAsaasApiHeaders()
    });
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao cancelar assinatura no Asaas:', error);
    throw error;
  }
}

/**
 * Obtém detalhes de uma assinatura no Asaas
 * 
 * @param {String} subscriptionId - ID da assinatura
 * @returns {Promise<Object>} - Resposta da API
 */
export async function getAsaasSubscription(subscriptionId) {
  try {
    const response = await fetch(getAsaasApiUrl(`/subscriptions/${subscriptionId}`), {
      method: 'GET',
      headers: getAsaasApiHeaders()
    });
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao obter assinatura do Asaas:', error);
    throw error;
  }
}

/**
 * Verifica se o usuário está elegível para checkout
 * 
 * @param {Object} user - Objeto do usuário
 * @returns {Object} - Resultado da verificação {isEligible, message}
 */
export function verifyCheckoutEligibility(user) {
  if (!user) {
    return { 
      isEligible: false, 
      message: 'Dados do usuário não encontrados' 
    };
  }

  const userId = user.id || user._id;
  
  if (!userId) {
    return { 
      isEligible: false, 
      message: 'ID do usuário não encontrado' 
    };
  }

  return { 
    isEligible: true, 
    message: 'Usuário elegível para checkout' 
  };
}

/**
 * Obtém a URL de checkout do Asaas
 * 
 * @param {String} planId - ID do plano ('basic' ou 'pro')
 * @returns {String} - URL base de checkout
 */
export function getAsaasCheckoutUrl(planId) {
  // Verificar se temos um plano válido
  if (!PLAN_IDS[planId]) {
    throw new Error(`ID do plano não encontrado: ${planId}`);
  }

  return `${ASAAS_BASE_URL}/c/${PLAN_IDS[planId]}`;
}

/**
 * Monta a URL com metadados para o checkout do Asaas
 * 
 * @param {String} baseUrl - URL base do checkout
 * @param {Object} metadata - Metadados para incluir no checkout
 * @returns {String} - URL completa do checkout
 */
export function buildAsaasCheckoutUrl(baseUrl, metadata) {
  // Construir objeto de query com os metadados
  const query = new URLSearchParams();
  
  // Adicionar cada metadado como parâmetro de URL
  for (const [key, value] of Object.entries(metadata)) {
    if (value) {
      query.append(key, value.toString());
    }
  }
  
  // Adicionar referência externa para identificar o usuário nas notificações
  if (metadata.userId) {
    query.append('externalReference', `userId:${metadata.userId}`);
  }
  
  // Retornar URL com query
  const queryString = query.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Redireciona para o checkout do Asaas com os parâmetros adequados
 * 
 * @param {String} planId - ID do plano ('basic' ou 'pro')
 * @param {String} userId - ID do usuário
 * @returns {Boolean} - Sucesso do redirecionamento
 */
export function redirectToAsaasCheckout(planId, userId) {
  try {
    // Verificar parâmetros
    if (!planId || !userId) {
      console.error('Parâmetros inválidos para checkout:', { planId, userId });
      return false;
    }
    
    // Obter URL base do checkout
    const baseUrl = getAsaasCheckoutUrl(planId);
    
    // Construir metadados para o checkout
    const metadata = {
      userId,
      plan: planId,
      referral: localStorage.getItem('referral') || ''
    };
    
    // Construir URL completa do checkout
    const checkoutUrl = buildAsaasCheckoutUrl(baseUrl, metadata);
    
    // Redirecionar para o checkout
    window.location.href = checkoutUrl;
    return true;
  } catch (error) {
    console.error('Erro ao redirecionar para checkout do Asaas:', error);
    return false;
  }
} 