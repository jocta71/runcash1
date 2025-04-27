const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'secret_padrao_roleta';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Definição dos níveis de assinatura e suas permissões
const SUBSCRIPTION_PLANS = {
  // Plano básico (gratuito ou assinatura básica)
  BASIC: {
    name: 'basic',
    maxRoulettes: 3,        // Pode acessar apenas 3 roletas
    maxHistoryItems: 10,    // Limitado a 10 itens de histórico por roleta
    refreshInterval: 10000  // Atualização a cada 10 segundos
  },
  
  // Plano premium
  PREMIUM: {
    name: 'premium',
    maxRoulettes: null,     // Sem limite de roletas
    maxHistoryItems: 50,    // Até 50 itens no histórico por roleta
    refreshInterval: 4000   // Atualização mais rápida (4s)
  },
  
  // Plano VIP
  VIP: {
    name: 'vip',
    maxRoulettes: null,     // Sem limite de roletas
    maxHistoryItems: null,  // Sem limite de histórico
    refreshInterval: 2000   // Atualização em tempo real (2s)
  }
};

/**
 * Middleware básico que verifica autenticação, mas não exige assinatura ativa
 * Útil para endpoints que oferecem funcionalidade limitada para usuários não pagantes
 */
exports.verificarAutenticacao = (req, res, next) => {
  try {
    // Verificar token no header
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      // Sem token, definir plano como básico com restrições
      req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
      return next();
    }
    
    try {
      // Verificar token JWT
      const decodificado = jwt.verify(token, JWT_SECRET);
      
      // Adicionar informações do usuário à requisição
      req.usuario = {
        id: decodificado.id,
        email: decodificado.email,
        asaasCustomerId: decodificado.asaasCustomerId
      };
      
      // Prosseguir para o próximo middleware enquanto a verificação da assinatura é feita
      next();
    } catch (error) {
      // Token inválido, tratar como usuário não autenticado (plano básico)
      req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
      return next();
    }
  } catch (error) {
    console.error('Erro na verificação de autenticação:', error);
    req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
    return next();
  }
};

/**
 * Middleware que verifica o plano de assinatura do usuário no Asaas
 * e define os limites de acesso adequados
 */
exports.verificarPlanoAssinatura = async (req, res, next) => {
  // Se não há usuário autenticado, já foi definido como BASIC no middleware anterior
  if (!req.usuario) {
    // Garantir que o plano esteja definido
    if (!req.planoAssinatura) {
      req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
    }
    return next();
  }
  
  try {
    // Se não há ID de cliente no Asaas, usar plano básico
    if (!req.usuario.asaasCustomerId) {
      req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
      return next();
    }
    
    // Verificar assinaturas ativas do cliente no Asaas
    const response = await axios.get(
      `${ASAAS_API_URL}/subscriptions`,
      {
        params: { customer: req.usuario.asaasCustomerId },
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Buscar assinatura ativa
    const assinaturas = response.data.data || [];
    const assinaturaAtiva = assinaturas.find(ass => ass.status === 'ACTIVE');
    
    if (!assinaturaAtiva) {
      // Sem assinatura ativa, definir como plano básico
      req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
      return next();
    }
    
    // Determinar o plano com base no valor da assinatura
    // Ajuste os valores conforme sua estrutura de preços
    const valorMensal = assinaturaAtiva.value || 0;
    
    if (valorMensal >= 49.90) {
      req.planoAssinatura = SUBSCRIPTION_PLANS.VIP;
    } else if (valorMensal >= 29.90) {
      req.planoAssinatura = SUBSCRIPTION_PLANS.PREMIUM;
    } else {
      req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
    }
    
    // Adicionar informações da assinatura à requisição
    req.assinatura = {
      id: assinaturaAtiva.id,
      status: assinaturaAtiva.status,
      valor: assinaturaAtiva.value,
      proxPagamento: assinaturaAtiva.nextDueDate,
      plano: req.planoAssinatura.name
    };
    
    next();
  } catch (error) {
    console.error('Erro ao verificar plano de assinatura:', error);
    // Em caso de erro, permitir acesso como plano básico
    req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
    next();
  }
};

/**
 * Aplica os limites conforme o plano de assinatura do usuário
 * Modifica parâmetros como limit e campos retornados
 */
exports.aplicarLimitesAssinatura = (req, res, next) => {
  // Garantir que o plano esteja definido
  if (!req.planoAssinatura) {
    req.planoAssinatura = SUBSCRIPTION_PLANS.BASIC;
  }
  
  // Aplicar limite ao parâmetro limit nas requisições
  if (req.query.limit !== undefined) {
    const requestedLimit = parseInt(req.query.limit) || 10;
    const maxLimit = req.planoAssinatura.maxHistoryItems;
    
    // Se o plano tem limite máximo, aplicá-lo
    if (maxLimit !== null) {
      req.query.limit = Math.min(requestedLimit, maxLimit);
    }
  }
  
  // Modificar resposta para incluir informações sobre o plano
  const oldSend = res.send;
  res.send = function(data) {
    try {
      // Se for uma resposta JSON, adicionar informações de assinatura
      if (typeof data === 'string' && data.startsWith('[') && data.endsWith(']')) {
        const parsed = JSON.parse(data);
        
        // Para usuários com plano básico, limitar o número de roletas
        if (req.planoAssinatura.maxRoulettes !== null && Array.isArray(parsed)) {
          const limitedData = parsed.slice(0, req.planoAssinatura.maxRoulettes);
          
          // Criar envelope com metadados de assinatura
          const responseWithMeta = {
            data: limitedData,
            subscription: {
              plan: req.planoAssinatura.name,
              limits: {
                maxRoulettes: req.planoAssinatura.maxRoulettes,
                maxHistoryItems: req.planoAssinatura.maxHistoryItems,
                refreshInterval: req.planoAssinatura.refreshInterval
              }
            }
          };
          
          return oldSend.call(this, JSON.stringify(responseWithMeta));
        }
      }
    } catch (e) {
      console.error('Erro ao modificar resposta:', e);
    }
    
    // Fallback para o comportamento original
    return oldSend.call(this, data);
  };
  
  next();
};

// Exportar planos para uso em outros módulos
exports.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS; 