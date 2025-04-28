const jwt = require('jsonwebtoken');
const axios = require('axios');

/**
 * Middleware para verificar assinaturas de usuários e controlar acesso às roletas
 * Implementa a lógica de verificação para endpoints específicos da API
 */

const verificarAssinaturaRoletas = (req, res, next) => {
  // Endpoints públicos que não requerem verificação de assinatura
  const PUBLIC_ENDPOINTS = [
    '/health',
    '/auth',
    '/subscription/status',
    '/subscription/create',
    '/payment'
  ];

  // Verifica se a rota atual é pública
  const isPublicEndpoint = PUBLIC_ENDPOINTS.some(endpoint => 
    req.path.startsWith(`/api${endpoint}`) || req.path === endpoint || req.path === `/api${endpoint}`
  );

  // Se for um endpoint público, permite o acesso sem verificação
  if (isPublicEndpoint) {
    return next();
  }

  // Para endpoints de ROULETTES, verifica permissões específicas
  if (req.path.includes('/ROULETTES')) {
    // Extrai o token de autenticação do cabeçalho
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    // Caso não tenha token, verifica se é modo de demonstração ou limita dados
    if (!token || token === 'undefined' || token === 'null') {
      // Opção 1: Mostrar dados limitados/demo
      req.isPremiumUser = false;
      return next();
    }

    try {
      // Verifica se o usuário tem informações de assinatura no req (definido por middleware anterior)
      if (req.user && req.user.subscription) {
        // Verifica se a assinatura está ativa
        const isActive = req.user.subscription.status === 'ACTIVE';
        req.isPremiumUser = isActive;
      } else {
        // Se não tiver informações de assinatura, considera como usuário não premium
        req.isPremiumUser = false;
      }

      // Permite que a requisição continue, mas com a flag isPremiumUser definida
      return next();
    } catch (error) {
      console.error('[Middleware] Erro ao verificar assinatura:', error);
      req.isPremiumUser = false;
      return next();
    }
  }

  // Para outros endpoints protegidos, verifica apenas autenticação básica
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Autenticação necessária.' });
  }

  // Permite que a requisição continue
  return next();
};

/**
 * Verifica o status da assinatura do cliente no Asaas
 * @param {string} customerId ID do cliente no Asaas
 * @returns {Object|null} Dados da assinatura ou null se não encontrada/erro
 */
async function verificarAssinaturaAsaas(customerId) {
  try {
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    
    if (!ASAAS_API_KEY) {
      console.error('[API] ASAAS_API_KEY não configurada');
      return null;
    }
    
    console.log(`[API] Verificando assinatura no Asaas para customer: ${customerId}`);
    
    // Criar instância do axios com timeout
    const axiosInstance = axios.create({
      timeout: 5000, // 5 segundos
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Buscar assinaturas do cliente com retry
    const maxRetries = 2;
    let retries = 0;
    let lastError = null;
    
    while (retries <= maxRetries) {
      try {
        const response = await axiosInstance.get(
          `${ASAAS_API_URL}/subscriptions?customer=${customerId}&status=ACTIVE`
        );
        
        // Verificar se há assinaturas ativas
        if (response.data && 
            response.data.data && 
            Array.isArray(response.data.data) && 
            response.data.data.length > 0) {
          
          console.log(`[API] Assinatura ativa encontrada no Asaas para customer: ${customerId}`);
          // Retornar a primeira assinatura ativa
          return response.data.data[0];
        }
        
        // Se chegou aqui, não encontrou assinaturas ativas
        console.log(`[API] Nenhuma assinatura ativa encontrada no Asaas para customer: ${customerId}`);
        return null;
      } catch (error) {
        lastError = error;
        retries++;
        
        if (retries <= maxRetries) {
          console.log(`[API] Tentativa ${retries}/${maxRetries} falhou, tentando novamente...`);
          // Esperar um tempo antes de tentar novamente (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
    
    // Se todas as tentativas falharam, logar o erro e retornar null
    console.error('[API] Todas as tentativas de conexão com Asaas falharam:', lastError?.message);
    return null;
  } catch (error) {
    console.error('[API] Erro ao verificar assinatura no Asaas:', error.message);
    return null;
  }
}

module.exports = verificarAssinaturaRoletas; 