/**
 * Middleware para verificação de assinatura diretamente na API do Asaas
 * Verifica se o usuário possui assinatura ativa no Asaas antes de liberar acesso
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const { promisify } = require('util');

// Configuração do ambiente Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
const API_BASE_URL = ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

// Configuração do JWT - deve ser obtida do arquivo de configuração
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

/**
 * Faz uma requisição à API do Asaas para verificar uma assinatura
 * 
 * @param {String} subscriptionId - ID da assinatura no Asaas
 * @returns {Object} Dados da assinatura
 */
const verificarAssinaturaNaApi = async (subscriptionId) => {
  try {
    const response = await axios({
      method: 'get',
      url: `${API_BASE_URL}/subscriptions/${subscriptionId}`,
      headers: {
        'access_token': ASAAS_API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro ao verificar assinatura no Asaas:', error.message);
    throw new Error('Falha ao verificar assinatura no Asaas');
  }
};

/**
 * Middleware para verificar se a assinatura do usuário está ativa no Asaas
 * 
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar ao próximo middleware
 */
exports.verificarAssinaturaAsaas = async (req, res, next) => {
  try {
    // Verificar se o token está presente
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado - token não fornecido',
        error: 'ERROR_NO_TOKEN'
      });
    }
    
    // Verificar e decodificar o token
    const decodificado = await promisify(jwt.verify)(token, JWT_SECRET);
    
    // Verificar se o objeto do usuário contém informações da assinatura
    if (!decodificado.assinaturaId) {
      return res.status(403).json({
        success: false,
        message: 'Token válido, mas sem informações de assinatura',
        error: 'ERROR_NO_SUBSCRIPTION_INFO'
      });
    }
    
    // Adicionar usuário básico à requisição
    req.usuario = {
      id: decodificado.id,
      nome: decodificado.nome,
      email: decodificado.email,
      assinaturaId: decodificado.assinaturaId
    };
    
    // Verificar a assinatura diretamente no Asaas
    const assinatura = await verificarAssinaturaNaApi(decodificado.assinaturaId);
    
    // Verificar se a assinatura está ativa
    if (assinatura.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Assinatura não está ativa',
        assinaturaStatus: assinatura.status,
        error: 'ERROR_INACTIVE_SUBSCRIPTION'
      });
    }
    
    // Adicionar dados da assinatura à requisição
    req.assinatura = {
      id: assinatura.id,
      status: assinatura.status,
      plano: assinatura.description,
      valor: assinatura.value,
      ciclo: assinatura.cycle,
      proximoPagamento: assinatura.nextDueDate
    };
    
    // Prosseguir para o próximo middleware
    next();
  } catch (error) {
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
    
    console.error('Erro ao verificar assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar assinatura',
      error: error.message
    });
  }
};

/**
 * Middleware simplificado para verificar assinatura no banco de dados e depois no Asaas
 * Útil quando a verificação no Asaas só é necessária em caso de dúvida
 * 
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar ao próximo middleware
 */
exports.verificarAssinaturaOtimizada = async (req, res, next) => {
  try {
    // Verificar se o token está presente
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado - token não fornecido',
        error: 'ERROR_NO_TOKEN'
      });
    }
    
    // Verificar e decodificar o token
    const decodificado = await promisify(jwt.verify)(token, JWT_SECRET);
    
    // Adicionar usuário básico à requisição
    req.usuario = {
      id: decodificado.id,
      nome: decodificado.nome,
      email: decodificado.email,
      assinaturaId: decodificado.assinaturaId
    };
    
    // Verificar se tem informações de assinatura no token
    if (!decodificado.assinaturaId) {
      return res.status(403).json({
        success: false,
        message: 'Token válido, mas sem informações de assinatura',
        error: 'ERROR_NO_SUBSCRIPTION_INFO'
      });
    }
    
    // Buscar assinatura no banco de dados primeiro (mais rápido)
    const db = req.app.locals.db;
    
    if (db) {
      const assinaturaBD = await db.collection('subscriptions').findOne({
        subscription_id: decodificado.assinaturaId,
        user_id: decodificado.id,
        status: 'active'
      });
      
      // Se encontrou uma assinatura ativa no BD, não precisa verificar no Asaas
      if (assinaturaBD) {
        req.assinatura = {
          id: assinaturaBD.subscription_id,
          status: 'active',
          plano: assinaturaBD.plan_id,
          valor: assinaturaBD.value
        };
        
        return next();
      }
    }
    
    // Se não encontrou no BD ou o BD não está disponível, verifica diretamente no Asaas
    const assinatura = await verificarAssinaturaNaApi(decodificado.assinaturaId);
    
    // Verificar se a assinatura está ativa
    if (assinatura.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Assinatura não está ativa',
        assinaturaStatus: assinatura.status,
        error: 'ERROR_INACTIVE_SUBSCRIPTION'
      });
    }
    
    // Adicionar dados da assinatura à requisição
    req.assinatura = {
      id: assinatura.id,
      status: assinatura.status,
      plano: assinatura.description,
      valor: assinatura.value,
      ciclo: assinatura.cycle,
      proximoPagamento: assinatura.nextDueDate
    };
    
    // Prosseguir para o próximo middleware
    next();
  } catch (error) {
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
    
    console.error('Erro ao verificar assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar assinatura',
      error: error.message
    });
  }
}; 