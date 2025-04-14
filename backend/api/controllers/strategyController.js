const Strategy = require('../models/Strategy');
const RouletteStrategy = require('../models/RouletteStrategy');
const mongoose = require('mongoose');

// @desc    Obter todas as estratégias do usuário
// @route   GET /api/strategies
// @access  Private
exports.getStrategies = async (req, res) => {
  try {
    // Obter estratégias do usuário atual e estratégias públicas
    const strategies = await Strategy.find({
      $or: [
        { userId: req.user.id },
        { isPublic: true },
        { isSystem: true }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: strategies.length,
      data: strategies
    });
  } catch (error) {
    console.error('Erro ao obter estratégias:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estratégias'
    });
  }
};

// @desc    Obter uma estratégia específica
// @route   GET /api/strategies/:id
// @access  Private
exports.getStrategy = async (req, res) => {
  try {
    const strategy = await Strategy.findById(req.params.id);

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Estratégia não encontrada'
      });
    }

    // Verificar se a estratégia pertence ao usuário ou é pública
    if (!strategy.isPublic && !strategy.isSystem && strategy.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para acessar esta estratégia'
      });
    }

    res.status(200).json({
      success: true,
      data: strategy
    });
  } catch (error) {
    console.error('Erro ao obter estratégia:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estratégia'
    });
  }
};

// @desc    Criar uma nova estratégia
// @route   POST /api/strategies
// @access  Private
exports.createStrategy = async (req, res) => {
  try {
    // Validar os dados
    const { name, description, rules, isPublic, terminalsConfig } = req.body;

    if (!name || !rules) {
      return res.status(400).json({
        success: false,
        error: 'Nome e regras são obrigatórios'
      });
    }

    // Criar nova estratégia
    const strategy = await Strategy.create({
      name,
      description,
      isPublic: isPublic || false,
      isSystem: false,
      userId: req.user.id,
      rules,
      terminalsConfig: terminalsConfig || {
        useDefaultTerminals: true,
        customTerminals: []
      }
    });

    res.status(201).json({
      success: true,
      data: strategy
    });
  } catch (error) {
    console.error('Erro ao criar estratégia:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar estratégia'
    });
  }
};

// @desc    Atualizar uma estratégia existente
// @route   PUT /api/strategies/:id
// @access  Private
exports.updateStrategy = async (req, res) => {
  try {
    let strategy = await Strategy.findById(req.params.id);

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Estratégia não encontrada'
      });
    }

    // Verificar se o usuário é o dono da estratégia
    if (strategy.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para atualizar esta estratégia'
      });
    }

    // Atualizar estratégia
    strategy = await Strategy.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        isSystem: false, // Impede que o usuário marque como estratégia do sistema
        updatedAt: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: strategy
    });
  } catch (error) {
    console.error('Erro ao atualizar estratégia:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar estratégia'
    });
  }
};

// @desc    Excluir uma estratégia
// @route   DELETE /api/strategies/:id
// @access  Private
exports.deleteStrategy = async (req, res) => {
  try {
    const strategy = await Strategy.findById(req.params.id);

    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Estratégia não encontrada'
      });
    }

    // Verificar se o usuário é o dono da estratégia
    if (strategy.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para excluir esta estratégia'
      });
    }

    // Verificar se a estratégia está em uso
    const inUse = await RouletteStrategy.findOne({ strategyId: strategy._id });
    if (inUse) {
      return res.status(400).json({
        success: false,
        error: 'Esta estratégia está em uso e não pode ser excluída'
      });
    }

    await strategy.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Erro ao excluir estratégia:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir estratégia'
    });
  }
};

// @desc    Associar uma estratégia a uma roleta
// @route   POST /api/strategies/assign
// @access  Private
exports.assignStrategy = async (req, res) => {
  try {
    const { roletaId, roletaNome, strategyId } = req.body;

    if (!roletaId || !strategyId || !roletaNome) {
      return res.status(400).json({
        success: false,
        error: 'ID da roleta, nome da roleta e ID da estratégia são obrigatórios'
      });
    }

    // Verificar se a estratégia existe
    const strategy = await Strategy.findById(strategyId);
    if (!strategy) {
      return res.status(404).json({
        success: false,
        error: 'Estratégia não encontrada'
      });
    }

    // Verificar se a estratégia é pública, do sistema ou pertence ao usuário
    if (!strategy.isPublic && !strategy.isSystem && strategy.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para usar esta estratégia'
      });
    }

    // Criar ou atualizar a associação
    const rouletteStrategy = await RouletteStrategy.findOneAndUpdate(
      { userId: req.user.id, roletaId },
      {
        userId: req.user.id,
        roletaId,
        roletaNome,
        strategyId,
        active: true,
        updatedAt: Date.now()
      },
      {
        new: true,
        upsert: true
      }
    );

    res.status(200).json({
      success: true,
      data: rouletteStrategy
    });
  } catch (error) {
    console.error('Erro ao associar estratégia:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao associar estratégia à roleta'
    });
  }
};

// @desc    Obter a estratégia associada a uma roleta
// @route   GET /api/strategies/roulette/:roletaId
// @access  Private
exports.getRouletteStrategy = async (req, res) => {
  try {
    const { roletaId } = req.params;

    // Buscar a associação
    const rouletteStrategy = await RouletteStrategy.findOne({
      userId: req.user.id,
      roletaId,
      active: true
    }).populate('strategyId');

    if (!rouletteStrategy) {
      return res.status(404).json({
        success: false,
        error: 'Nenhuma estratégia associada a esta roleta'
      });
    }

    res.status(200).json({
      success: true,
      data: rouletteStrategy
    });
  } catch (error) {
    console.error('Erro ao obter estratégia da roleta:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao obter estratégia da roleta'
    });
  }
}; 