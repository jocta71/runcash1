const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const Subscription = require('../models/subscription.model');
const ApiAccess = require('../models/apiAccess.model');
const User = require('../models/user.model');
const jwtUtils = require('../utils/jwt.utils');

/**
 * @route   GET /api/subscription/status
 * @desc    Verifica o status da assinatura do usuário autenticado
 * @access  Private
 */
router.get('/status', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Buscar assinatura ativa
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ['ACTIVE', 'PENDING'] }
    }).sort({ createdAt: -1 });
    
    // Buscar acesso à API
    const apiAccess = await ApiAccess.findOne({ userId });
    
    // Construir resposta
    const response = {
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name
      },
      subscription: subscription ? {
        id: subscription._id,
        status: subscription.status,
        value: subscription.value,
        nextDueDate: subscription.nextDueDate,
        billingType: subscription.billingType,
        cycle: subscription.cycle,
        asaasSubscriptionId: subscription.asaasSubscriptionId
      } : null,
      apiAccess: apiAccess ? {
        isActive: apiAccess.isActive,
        plan: apiAccess.plan,
        endDate: apiAccess.endDate,
        startDate: apiAccess.startDate,
        requestCount: apiAccess.requestCount,
        dailyLimit: apiAccess.dailyLimit,
        lastRequest: apiAccess.lastRequest
      } : null
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('[Subscription] Erro ao verificar status:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/subscription/verify/:externalId
 * @desc    Verifica se um usuário tem acesso à API (endpoint voltado para a aplicação principal)
 * @access  Private (apenas a API principal deve acessar)
 */
router.get('/verify/:externalId', async (req, res) => {
  try {
    // Esta rota só deve ser acessada pela API principal
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.MAIN_API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado'
      });
    }
    
    const { externalId } = req.params;
    const endpoint = req.query.endpoint || '/api/roulettes';
    const method = req.query.method || 'GET';
    
    if (!externalId) {
      return res.status(400).json({
        success: false,
        message: 'ID externo do usuário é obrigatório'
      });
    }
    
    // Buscar usuário pelo ID externo
    const user = await User.findOne({ externalId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Buscar acesso à API
    const apiAccess = await ApiAccess.findOne({ userId: user._id });
    
    if (!apiAccess) {
      return res.status(403).json({
        success: false,
        message: 'Usuário não tem acesso à API',
        canAccess: false
      });
    }
    
    // Verificar se o usuário tem acesso ao endpoint
    const hasAccess = apiAccess.canAccessEndpoint(endpoint, method);
    
    // Incrementar contador de requisições se o usuário tem acesso
    if (hasAccess) {
      await apiAccess.incrementRequestCount();
    }
    
    // Gerar token JWT com as permissões
    const token = jwtUtils.generateToken(user, apiAccess);
    
    return res.status(200).json({
      success: true,
      canAccess: hasAccess,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        externalId: user.externalId
      },
      access: {
        isActive: apiAccess.isActive,
        plan: apiAccess.plan,
        requestCount: apiAccess.requestCount,
        dailyLimit: apiAccess.dailyLimit
      },
      token
    });
  } catch (error) {
    console.error('[Subscription] Erro ao verificar acesso:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar acesso à API',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/subscription/create-customer
 * @desc    Cria um cliente no Asaas e prepara para assinatura
 * @access  Private
 */
router.post('/create-customer', authMiddleware.authenticate, async (req, res) => {
  try {
    // Implementação do endpoint para criar cliente no Asaas
    // Este é um placeholder - a implementação real incluiria:
    // 1. Validar dados do usuário
    // 2. Criar cliente no Asaas via asaasService
    // 3. Atualizar o usuário com o ID do cliente no Asaas
    // 4. Retornar dados necessários para o frontend continuar o fluxo
    
    res.status(501).json({
      success: false,
      message: 'Endpoint ainda não implementado'
    });
  } catch (error) {
    console.error('[Subscription] Erro ao criar cliente:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar cliente',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/subscription/create-subscription
 * @desc    Cria uma assinatura no Asaas
 * @access  Private
 */
router.post('/create-subscription', authMiddleware.authenticate, async (req, res) => {
  try {
    // Implementação do endpoint para criar assinatura no Asaas
    // Este é um placeholder - a implementação real incluiria:
    // 1. Validar dados da requisição
    // 2. Verificar se o usuário já tem um cliente no Asaas
    // 3. Criar assinatura no Asaas via asaasService
    // 4. Criar registro de assinatura no banco de dados
    // 5. Retornar link de pagamento ou outras informações necessárias
    
    res.status(501).json({
      success: false,
      message: 'Endpoint ainda não implementado'
    });
  } catch (error) {
    console.error('[Subscription] Erro ao criar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar assinatura',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 