/**
 * Middleware que combina autenticação JWT e verificação
 * de assinatura ativa no Asaas
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configurações do JWT
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

// Configurações do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Tempo limite para requisições à API do Asaas (em ms)
const ASAAS_TIMEOUT = 5000;

/**
 * Registra informações de auditoria
 * @param {Object} req - Objeto de requisição
 * @param {string} action - Ação realizada
 * @param {string} status - Status da ação (sucesso/falha)
 * @param {Object} details - Detalhes adicionais
 */
const logAudit = (req, action, status, details = {}) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.headers['x-forwarded-for'] || 'desconhecido';
  const userId = req.usuario?.id || 'não autenticado';
  const method = req.method;
  const path = req.path;
  
  console.log(JSON.stringify({
    timestamp,
    action,
    status,
    ip,
    userId,
    method,
    path,
    userAgent: req.headers['user-agent'],
    ...details
  }));
};

/**
 * Middleware para verificar autenticação JWT e assinatura ativa no Asaas
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.verificarAutenticacaoEAssinatura = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    // 1. Verificar se o token está presente
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logAudit(req, 'autenticacao', 'falha', { 
        motivo: 'Token não fornecido ou formato inválido',
        erro: 'ERROR_NO_TOKEN' 
      });
      
      return res.status(401).json({
        success: false,
        message: 'Não autorizado - token não fornecido ou formato inválido',
        error: 'ERROR_NO_TOKEN'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 2. Verificar e decodificar o token JWT
    let decodificado;
    try {
      decodificado = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      const errorType = error.name === 'TokenExpiredError' 
        ? 'ERROR_TOKEN_EXPIRED' 
        : 'ERROR_INVALID_TOKEN';
      
      const errorMessage = error.name === 'TokenExpiredError'
        ? 'Token expirado, faça login novamente'
        : 'Token inválido';
      
      logAudit(req, 'autenticacao', 'falha', { 
        motivo: errorMessage,
        erro: errorType,
        detalhes: { nome: error.name, mensagem: error.message }
      });
      
      return res.status(401).json({
        success: false,
        message: errorMessage,
        error: errorType
      });
    }
    
    // 3. Validar campos obrigatórios no token
    if (!decodificado.id || !decodificado.email) {
      logAudit(req, 'autenticacao', 'falha', { 
        motivo: 'Token com informações incompletas',
        erro: 'ERROR_INVALID_TOKEN_DATA' 
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido (dados incompletos)',
        error: 'ERROR_INVALID_TOKEN_DATA'
      });
    }
    
    // 4. Adicionar informações do usuário ao objeto da requisição
    req.usuario = {
      id: decodificado.id,
      nome: decodificado.nome || 'Usuário',
      email: decodificado.email,
      asaasCustomerId: decodificado.asaasCustomerId || null,
      perfil: decodificado.perfil || 'usuario'
    };
    
    // 5. Verificar se é um usuário administrativo (bypass verificação Asaas)
    if (req.usuario.perfil === 'admin' || req.usuario.perfil === 'superadmin') {
      logAudit(req, 'autenticacao', 'sucesso', {
        userId: req.usuario.id,
        bypass: true,
        motivo: 'Usuário administrativo'
      });
      
      return next();
    }
    
    // 6. Se não há ID de cliente no Asaas, negar acesso
    if (!req.usuario.asaasCustomerId) {
      logAudit(req, 'verificacao_assinatura', 'falha', {
        userId: req.usuario.id,
        motivo: 'Usuário sem ID de cliente Asaas',
        erro: 'ERROR_NO_SUBSCRIPTION'
      });
      
      return res.status(403).json({
        success: false,
        message: 'Usuário não possui assinatura cadastrada',
        error: 'ERROR_NO_SUBSCRIPTION',
        requiresSubscription: true
      });
    }
    
    // 7. Verificar assinaturas ativas do cliente no Asaas
    try {
      const response = await axios.get(
        `${ASAAS_API_URL}/subscriptions`,
        {
          params: { customer: req.usuario.asaasCustomerId },
          headers: { 
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: ASAAS_TIMEOUT
        }
      );
      
      // 8. Verificar se há alguma assinatura ativa
      const assinaturas = response.data.data || [];
      const assinaturaAtiva = assinaturas.find(ass => ass.status === 'ACTIVE');
      
      if (!assinaturaAtiva) {
        logAudit(req, 'verificacao_assinatura', 'falha', {
          userId: req.usuario.id,
          customerId: req.usuario.asaasCustomerId,
          motivo: 'Nenhuma assinatura ativa encontrada',
          erro: 'ERROR_INACTIVE_SUBSCRIPTION',
          assinaturas: assinaturas.map(a => ({ id: a.id, status: a.status }))
        });
        
        return res.status(403).json({
          success: false,
          message: 'Assinatura inativa ou cancelada',
          error: 'ERROR_INACTIVE_SUBSCRIPTION',
          requiresSubscription: true
        });
      }
      
      // 9. Adicionar informações da assinatura à requisição
      req.assinatura = {
        id: assinaturaAtiva.id,
        status: assinaturaAtiva.status,
        valor: assinaturaAtiva.value,
        proxPagamento: assinaturaAtiva.nextDueDate,
        plano: assinaturaAtiva.billingType || 'UNDEFINED'
      };
      
      // 10. Verificar se há algum pagamento em atraso crítico
      if (assinaturaAtiva.description?.includes('[ATRASO]')) {
        logAudit(req, 'verificacao_assinatura', 'alerta', {
          userId: req.usuario.id,
          assinaturaId: assinaturaAtiva.id,
          motivo: 'Assinatura com pagamento em atraso',
          alerta: 'WARNING_PAYMENT_DELAYED'
        });
        
        // Adicionar alerta à requisição, mas permite o acesso
        req.assinaturaAlerta = {
          tipo: 'ATRASO',
          mensagem: 'Sua assinatura possui pagamento em atraso. Regularize para evitar bloqueio.'
        };
      }
      
      logAudit(req, 'verificacao_assinatura', 'sucesso', {
        userId: req.usuario.id,
        assinaturaId: assinaturaAtiva.id,
        proxPagamento: assinaturaAtiva.nextDueDate
      });
      
      // 11. Log de tempo total
      const tempoTotal = Date.now() - startTime;
      console.log(`Verificação completa em ${tempoTotal}ms`);
      
      // 12. Prosseguir para o próximo middleware
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura no Asaas:', error.message);
      
      logAudit(req, 'verificacao_assinatura', 'erro', {
        userId: req.usuario.id,
        customerId: req.usuario.asaasCustomerId,
        erro: error.code || 'ERROR_CHECKING_SUBSCRIPTION',
        mensagem: error.message,
        // Se for erro de timeout, incluir essa informação
        timeout: error.code === 'ECONNABORTED' ? true : undefined
      });
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        error: 'ERROR_CHECKING_SUBSCRIPTION'
      });
    }
  } catch (error) {
    console.error('Erro não tratado:', error);
    
    logAudit(req, 'middleware', 'erro_critico', {
      erro: 'INTERNAL_SERVER_ERROR',
      mensagem: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}; 