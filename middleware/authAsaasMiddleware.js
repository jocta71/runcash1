/**
 * Middleware para autenticação com JWT e verificação de assinatura Asaas
 * Protege rotas da API exigindo autenticação e assinatura ativa
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuração do JWT
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

// Configuração da API Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const ASAAS_API_URL = ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

/**
 * Middleware que verifica autenticação JWT e assinatura ativa no Asaas
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar para o próximo middleware
 */
const verificarAutenticacaoEAssinatura = async (req, res, next) => {
  try {
    // 1. Verificar token JWT
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado - token não fornecido',
        error: 'ERROR_NO_TOKEN'
      });
    }
    
    // Verificar e decodificar o token
    const decodificado = jwt.verify(token, JWT_SECRET);
    
    // 2. Verificar assinatura no Asaas
    const asaasCustomerId = decodificado.asaasCustomerId;
    
    if (!asaasCustomerId) {
      return res.status(403).json({
        success: false,
        message: 'Usuário não possui assinatura cadastrada',
        error: 'ERROR_NO_SUBSCRIPTION',
        requiresSubscription: true
      });
    }
    
    // Verificar se a chave da API Asaas está configurada
    if (!ASAAS_API_KEY) {
      console.warn('ASAAS_API_KEY não configurada. Acesso permitido sem verificar assinatura.');
      
      // Adicionar informações do usuário à requisição
      req.usuario = decodificado;
      return next();
    }
    
    // Configurar cliente API Asaas
    const apiClient = axios.create({
      baseURL: ASAAS_API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Buscar assinaturas do cliente
    const response = await apiClient.get('/subscriptions', {
      params: { customer: asaasCustomerId }
    });
    
    const assinaturas = response.data.data || [];
    
    // Verificar se existe alguma assinatura ativa
    const assinaturaAtiva = assinaturas.find(ass => ass.status === 'ACTIVE');
    
    if (!assinaturaAtiva) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: assinatura inativa ou inexistente',
        error: 'ERROR_INACTIVE_SUBSCRIPTION',
        requiresSubscription: true,
        subscriptionStatus: assinaturas.length > 0 ? assinaturas[0].status : 'NONE'
      });
    }
    
    // Assinatura está ativa, adicionar informações do usuário e assinatura à requisição
    req.usuario = decodificado;
    req.assinatura = {
      id: assinaturaAtiva.id,
      status: assinaturaAtiva.status,
      valor: assinaturaAtiva.value,
      proxPagamento: assinaturaAtiva.nextDueDate,
      plano: assinaturaAtiva.billingType
    };
    
    // Continuar para o próximo middleware
    next();
  } catch (error) {
    console.error('Erro na verificação de autenticação/assinatura:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado, faça login novamente',
        error: 'ERROR_TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'ERROR_INVALID_TOKEN'
      });
    }
    
    // Verificar se o erro é da API do Asaas
    if (error.response && error.response.data) {
      console.error('Erro na API do Asaas:', error.response.data);
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        error: 'ERROR_ASAAS_API'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
};

module.exports = {
  verificarAutenticacaoEAssinatura
}; 