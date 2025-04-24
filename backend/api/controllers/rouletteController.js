const asyncHandler = require('express-async-handler');
const Roulette = require('../models/rouletteModel');
const SubscriptionService = require('../services/SubscriptionService');
const SecurityUtils = require('../utils/SecurityUtils');

// Cria um rate limiter específico para acessos às roletas
const rouletteLimiter = SecurityUtils.createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20,                 // máximo de 20 requisições por janela
  message: 'Muitas requisições de roleta. Tente novamente em 5 minutos.'
});

/**
 * @desc    Obter todas as roletas disponíveis para o usuário
 * @route   GET /api/roulettes
 * @access  Privado (Apenas assinantes)
 */
const getAvailableRoulettes = asyncHandler(async (req, res) => {
  // Sanitizar parâmetros da requisição
  const sanitizedQuery = SecurityUtils.sanitizeData(req.query);

  // Definir filtragem padrão
  const filters = { active: true };
  
  // Verificar nível de acesso do usuário para determinar quais roletas mostrar
  if (req.user && req.user.subscription) {
    const { plan } = req.user.subscription;
    
    if (plan === 'basic') {
      // Usuários básicos só podem ver roletas básicas
      filters.accessLevel = 'basic';
    } else if (plan === 'premium') {
      // Usuários premium podem ver roletas básicas e premium
      filters.accessLevel = { $in: ['basic', 'premium'] };
    } else if (plan === 'vip') {
      // Usuários VIP podem ver todas as roletas
      // Não adiciona filtro de accessLevel
    }
  } else {
    // Usuários sem assinatura só podem ver roletas de demonstração
    filters.accessLevel = 'demo';
  }

  // Registrar tentativa de acesso
  SecurityUtils.logSecurityEvent(req.user._id, 'Acesso às roletas', req);

  try {
    const roulettes = await Roulette.find(filters)
      .select('name description type winRate category tags lastUpdated thumbnailUrl')
      .sort({ createdAt: -1 });

    // Aplicar transformações de segurança antes de enviar os dados
    const secureRoulettes = roulettes.map(roulette => {
      const rouletteObj = roulette.toObject();
      // Remover qualquer informação sensível
      delete rouletteObj.secretSettings;
      delete rouletteObj.adminNotes;
      return rouletteObj;
    });

    res.status(200).json({
      success: true,
      count: secureRoulettes.length,
      data: secureRoulettes
    });
  } catch (error) {
    SecurityUtils.logSecurityEvent(req.user._id, 'Erro ao buscar roletas', req);
    
    res.status(500);
    throw new Error('Erro ao buscar roletas: ' + error.message);
  }
});

/**
 * @desc    Obter uma roleta pelo ID
 * @route   GET /api/roulettes/:id
 * @access  Privado (Apenas assinantes)
 */
const getRouletteById = asyncHandler(async (req, res) => {
  // Validar ID da MongoDB
  if (!SecurityUtils.isValidMongoId(req.params.id)) {
    res.status(400);
    throw new Error('ID inválido');
  }

  try {
    const roulette = await Roulette.findById(req.params.id);

    if (!roulette) {
      res.status(404);
      throw new Error('Roleta não encontrada');
    }

    // Verificar se o usuário tem permissão para acessar esta roleta
    const { plan } = req.user.subscription || { plan: 'none' };
    
    if (
      (roulette.accessLevel === 'premium' && !['premium', 'vip'].includes(plan)) ||
      (roulette.accessLevel === 'vip' && plan !== 'vip') ||
      (roulette.accessLevel !== 'demo' && plan === 'none')
    ) {
      SecurityUtils.logSecurityEvent(req.user._id, `Acesso negado à roleta ${roulette._id}`, req);
      
      res.status(403);
      throw new Error('Assinatura necessária para acessar esta roleta');
    }

    // Registrar acesso à roleta específica
    SecurityUtils.logSecurityEvent(req.user._id, `Acesso à roleta ${roulette._id}`, req);

    // Remover campos sensíveis
    const secureRoulette = roulette.toObject();
    delete secureRoulette.secretSettings;
    delete secureRoulette.adminNotes;

    res.status(200).json({
      success: true,
      data: secureRoulette
    });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    throw new Error(error.message);
  }
});

/**
 * @desc    Criar nova roleta (apenas para administradores)
 * @route   POST /api/roulettes
 * @access  Privado (Apenas administradores)
 */
const createRoulette = asyncHandler(async (req, res) => {
  // Verificar se o usuário é administrador - isso deve ser verificado no middleware
  if (req.user.role !== 'admin') {
    SecurityUtils.logSecurityEvent(req.user._id, 'Tentativa não autorizada de criar roleta', req);
    
    res.status(403);
    throw new Error('Não autorizado');
  }

  // Sanitizar dados
  const sanitizedData = SecurityUtils.sanitizeData(req.body);
  
  // Verificar se existem padrões suspeitos nos dados
  if (SecurityUtils.hasSuspiciousPatterns(JSON.stringify(req.body))) {
    SecurityUtils.logSecurityEvent(req.user._id, 'Dados suspeitos em criação de roleta', req);
    
    res.status(400);
    throw new Error('Dados potencialmente maliciosos detectados');
  }

  try {
    const roulette = await Roulette.create({
      ...sanitizedData,
      createdBy: req.user._id
    });

    // Registrar criação
    SecurityUtils.logSecurityEvent(req.user._id, `Roleta criada: ${roulette._id}`, req);

    res.status(201).json({
      success: true,
      data: roulette
    });
  } catch (error) {
    res.status(400);
    throw new Error('Erro ao criar roleta: ' + error.message);
  }
});

/**
 * @desc    Atualizar roleta (apenas para administradores)
 * @route   PUT /api/roulettes/:id
 * @access  Privado (Apenas administradores)
 */
const updateRoulette = asyncHandler(async (req, res) => {
  // Validar ID da MongoDB
  if (!SecurityUtils.isValidMongoId(req.params.id)) {
    res.status(400);
    throw new Error('ID inválido');
  }

  // Verificar se o usuário é administrador - isso deve ser verificado no middleware
  if (req.user.role !== 'admin') {
    SecurityUtils.logSecurityEvent(req.user._id, 'Tentativa não autorizada de atualizar roleta', req);
    
    res.status(403);
    throw new Error('Não autorizado');
  }

  // Sanitizar dados
  const sanitizedData = SecurityUtils.sanitizeData(req.body);

  try {
    const roulette = await Roulette.findById(req.params.id);

    if (!roulette) {
      res.status(404);
      throw new Error('Roleta não encontrada');
    }

    // Atualizar roleta
    const updatedRoulette = await Roulette.findByIdAndUpdate(
      req.params.id,
      { 
        ...sanitizedData,
        lastUpdated: Date.now() 
      },
      { new: true, runValidators: true }
    );

    // Registrar atualização
    SecurityUtils.logSecurityEvent(req.user._id, `Roleta atualizada: ${updatedRoulette._id}`, req);

    res.status(200).json({
      success: true,
      data: updatedRoulette
    });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    throw new Error(error.message);
  }
});

/**
 * @desc    Excluir roleta (apenas para administradores)
 * @route   DELETE /api/roulettes/:id
 * @access  Privado (Apenas administradores)
 */
const deleteRoulette = asyncHandler(async (req, res) => {
  // Validar ID da MongoDB
  if (!SecurityUtils.isValidMongoId(req.params.id)) {
    res.status(400);
    throw new Error('ID inválido');
  }

  // Verificar se o usuário é administrador - isso deve ser verificado no middleware
  if (req.user.role !== 'admin') {
    SecurityUtils.logSecurityEvent(req.user._id, 'Tentativa não autorizada de excluir roleta', req);
    
    res.status(403);
    throw new Error('Não autorizado');
  }

  try {
    const roulette = await Roulette.findById(req.params.id);

    if (!roulette) {
      res.status(404);
      throw new Error('Roleta não encontrada');
    }

    // Excluir roleta (usar deleteOne para acionar eventos/middleware do mongoose)
    await roulette.deleteOne();

    // Registrar exclusão
    SecurityUtils.logSecurityEvent(req.user._id, `Roleta excluída: ${req.params.id}`, req);

    res.status(200).json({
      success: true,
      message: 'Roleta excluída com sucesso'
    });
  } catch (error) {
    res.status(res.statusCode === 200 ? 500 : res.statusCode);
    throw new Error(error.message);
  }
});

module.exports = {
  getAvailableRoulettes,
  getRouletteById,
  createRoulette,
  updateRoulette,
  deleteRoulette
}; 