/**
 * Função serverless para autenticação e operações relacionadas a usuários
 * Centraliza lógica de autenticação e verificação de credenciais
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
  if (!utils.validateMethod(req, res, ['POST', 'GET'])) {
    return;
  }
  
  try {
    // Direcionar para a operação apropriada com base no caminho
    const action = req.query.action || 'verify';
    
    switch (action) {
      case 'verify':
        return await verifyToken(req, res);
      case 'login':
        return await login(req, res);
      case 'validate-subscription':
        return await validateSubscription(req, res);
      default:
        return utils.errorResponse(res, 400, 'Ação não reconhecida');
    }
  } catch (error) {
    console.error('Erro na função de autenticação:', error);
    return utils.errorResponse(res, 500, 'Erro interno no servidor', 
      process.env.NODE_ENV === 'development' ? { error: error.message } : null
    );
  }
};

/**
 * Verifica se o token é válido
 * @param {object} req - Requisição HTTP
 * @param {object} res - Resposta HTTP
 */
async function verifyToken(req, res) {
  const token = utils.extractToken(req);
  
  if (!token) {
    return utils.errorResponse(res, 401, 'Token não fornecido');
  }
  
  const verification = utils.verifyToken(token);
  
  if (!verification.valid) {
    return utils.errorResponse(res, 401, 'Token inválido', { error: verification.error });
  }
  
  // Obter dados atualizados do usuário do banco de dados
  try {
    const db = await utils.connectToMongoDB();
    const usersCollection = db.collection('users');
    
    const userId = verification.decoded.userId;
    const user = await usersCollection.findOne({ 
      _id: utils.toObjectId(userId) 
    }, { 
      projection: { password: 0 } // Excluir senha
    });
    
    if (!user) {
      return utils.errorResponse(res, 404, 'Usuário não encontrado');
    }
    
    return utils.successResponse(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        asaasCustomerId: user.asaasCustomerId || null,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return utils.errorResponse(res, 500, 'Erro ao verificar usuário');
  }
}

/**
 * Realiza login do usuário
 * @param {object} req - Requisição HTTP
 * @param {object} res - Resposta HTTP
 */
async function login(req, res) {
  const { email, password } = req.body;
  
  // Validar campos obrigatórios
  const validationError = utils.validateRequiredFields(
    { email, password },
    ['email', 'password']
  );
  
  if (validationError) {
    return utils.errorResponse(res, 400, validationError.message, validationError);
  }
  
  try {
    // Conectar ao MongoDB
    const db = await utils.connectToMongoDB();
    const usersCollection = db.collection('users');
    
    // Buscar usuário pelo e-mail
    const user = await usersCollection.findOne({ email });
    
    if (!user) {
      return utils.errorResponse(res, 401, 'Credenciais inválidas');
    }
    
    // Comparar senha com bcrypt - simulado aqui, implementar com bcrypt real
    const isValidPassword = password === user.password; // Substituir por bcrypt.compare
    
    if (!isValidPassword) {
      return utils.errorResponse(res, 401, 'Credenciais inválidas');
    }
    
    // Gerar token JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        userId: user._id.toString(),
        email: user.email
      },
      process.env.JWT_SECRET || 'sua-chave-secreta',
      { expiresIn: '7d' }
    );
    
    // Retornar dados do usuário e token
    return utils.successResponse(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        asaasCustomerId: user.asaasCustomerId || null,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return utils.errorResponse(res, 500, 'Erro interno no servidor');
  }
}

/**
 * Valida se o usuário possui assinatura ativa
 * @param {object} req - Requisição HTTP
 * @param {object} res - Resposta HTTP
 */
async function validateSubscription(req, res) {
  const token = utils.extractToken(req);
  
  if (!token) {
    return utils.errorResponse(res, 401, 'Token não fornecido');
  }
  
  const verification = utils.verifyToken(token);
  
  if (!verification.valid) {
    return utils.errorResponse(res, 401, 'Token inválido');
  }
  
  try {
    // Conectar ao MongoDB
    const db = await utils.connectToMongoDB();
    const usersCollection = db.collection('users');
    
    // Obter usuário
    const userId = verification.decoded.userId;
    const user = await usersCollection.findOne({ 
      _id: utils.toObjectId(userId) 
    });
    
    if (!user) {
      return utils.errorResponse(res, 404, 'Usuário não encontrado');
    }
    
    // Verificar se o usuário tem customerId
    if (!user.asaasCustomerId) {
      return utils.successResponse(res, {
        hasActiveSubscription: false,
        reason: 'CUSTOMER_NOT_FOUND'
      });
    }
    
    // Fazer requisição ao Asaas para verificar assinatura
    const asaas = utils.asaasClient();
    const response = await asaas.get(`/subscriptions`, {
      params: {
        customer: user.asaasCustomerId,
        status: 'ACTIVE'
      }
    });
    
    const activeSubscriptions = response.data.data || [];
    
    if (activeSubscriptions.length === 0) {
      return utils.successResponse(res, {
        hasActiveSubscription: false,
        reason: 'NO_ACTIVE_SUBSCRIPTION'
      });
    }
    
    // Verificar pagamento mais recente
    const latestSubscription = activeSubscriptions[0];
    
    const paymentResponse = await asaas.get(`/payments`, {
      params: {
        subscription: latestSubscription.id,
        status: 'CONFIRMED,RECEIVED',
        limit: 1,
        offset: 0
      }
    });
    
    const hasConfirmedPayment = (paymentResponse.data.data || []).length > 0;
    
    return utils.successResponse(res, {
      hasActiveSubscription: hasConfirmedPayment,
      subscriptionId: latestSubscription.id,
      status: latestSubscription.status,
      reason: hasConfirmedPayment ? null : 'NO_CONFIRMED_PAYMENT'
    });
  } catch (error) {
    console.error('Erro ao validar assinatura:', error);
    return utils.errorResponse(res, 500, 'Erro ao validar assinatura');
  }
} 