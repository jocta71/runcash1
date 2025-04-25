const Roulette = require('../models/Roulette');
const RouletteData = require('../models/RouletteData');

/**
 * Controlador para gerenciar dados das roletas
 * Separa claramente dados básicos de dados premium
 */

// Dados básicos - acessíveis para todos usuários autenticados
exports.getBasicRouletteInfo = async (req, res) => {
  try {
    const roulettes = await Roulette.find({}, {
      // Selecionar apenas campos básicos
      _id: 1,
      name: 1,
      nome: 1,
      provider: 1,
      createdAt: 1,
      updatedAt: 1
    });
    
    return res.status(200).json({
      success: true,
      count: roulettes.length,
      data: roulettes
    });
  } catch (error) {
    console.error('Erro ao buscar informações básicas das roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar informações básicas das roletas'
    });
  }
};

// Listar provedores - informação pública
exports.getRouletteProviders = async (req, res) => {
  try {
    const providers = await Roulette.distinct('provider');
    return res.status(200).json({
      success: true,
      count: providers.length,
      data: providers.map(provider => ({
        id: provider,
        name: provider
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar provedores:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar provedores de roletas'
    });
  }
};

// Métodos protegidos - requerem assinatura ativa

// Obter todas as roletas com dados completos
exports.getAllRoulettes = async (req, res) => {
  try {
    const roulettes = await Roulette.find({}).populate('data');
    
    return res.status(200).json({
      success: true,
      count: roulettes.length,
      data: roulettes
    });
  } catch (error) {
    console.error('Erro ao buscar roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar todas as roletas'
    });
  }
};

// Obter roletas com números (endpoint principal usado pelo frontend)
exports.getWithNumbers = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    const roulettes = await Roulette.find({}).limit(limit);
    const result = [];
    
    for (const roulette of roulettes) {
      // Obter os dados mais recentes para esta roleta
      const latestData = await RouletteData.findOne({ rouletteId: roulette._id })
        .sort({ createdAt: -1 })
        .limit(1);
      
      // Combinar roleta com seus dados
      const rouletteWithData = {
        ...roulette.toObject(),
        numero: latestData?.numbers || [],
        lastNumbers: latestData?.numbers || [],
        vitorias: latestData?.wins || 0,
        derrotas: latestData?.losses || 0
      };
      
      result.push(rouletteWithData);
    }
    
    return res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('Erro ao buscar roletas com números:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar roletas com números'
    });
  }
};

// Obter detalhes de uma roleta específica
exports.getRouletteDetailed = async (req, res) => {
  try {
    const { id } = req.params;
    
    const roulette = await Roulette.findById(id);
    if (!roulette) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada'
      });
    }
    
    const data = await RouletteData.find({ rouletteId: id })
      .sort({ createdAt: -1 })
      .limit(100);
    
    return res.status(200).json({
      success: true,
      data: {
        ...roulette.toObject(),
        historicalData: data
      }
    });
  } catch (error) {
    console.error(`Erro ao buscar detalhes da roleta ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar detalhes da roleta'
    });
  }
};

// Obter histórico de uma roleta
exports.getRouletteHistorical = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    
    const historicalData = await RouletteData.find({ rouletteId: id })
      .sort({ createdAt: -1 })
      .limit(limit);
    
    return res.status(200).json({
      success: true,
      count: historicalData.length,
      data: historicalData
    });
  } catch (error) {
    console.error(`Erro ao buscar histórico da roleta ${req.params.id}:`, error);
    return res.status(500).json({
      success: false, 
      message: 'Erro ao buscar histórico da roleta'
    });
  }
};

// Obter estatísticas de uma roleta
exports.getRouletteStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obter a roleta
    const roulette = await Roulette.findById(id);
    if (!roulette) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada'
      });
    }
    
    // Obter dados para estatísticas
    const data = await RouletteData.find({ rouletteId: id })
      .sort({ createdAt: -1 })
      .limit(1000);
    
    // Extrair números
    const allNumbers = [];
    data.forEach(item => {
      if (Array.isArray(item.numbers)) {
        allNumbers.push(...item.numbers);
      }
    });
    
    // Calcular estatísticas de frequência
    const frequency = {};
    for (let i = 0; i <= 36; i++) {
      frequency[i] = 0;
    }
    
    allNumbers.forEach(num => {
      if (frequency[num] !== undefined) {
        frequency[num]++;
      }
    });
    
    // Converter para formato de array
    const frequencyData = Object.keys(frequency).map(key => ({
      number: parseInt(key),
      frequency: frequency[parseInt(key)]
    }));
    
    // Obter números quentes e frios
    const sortedFrequency = [...frequencyData].sort((a, b) => b.frequency - a.frequency);
    const hot = sortedFrequency.slice(0, 5);
    const cold = sortedFrequency.slice(-5).reverse();
    
    return res.status(200).json({
      success: true,
      data: {
        roulette: roulette.toObject(),
        totalNumbers: allNumbers.length,
        frequencyData,
        hot,
        cold,
        lastNumbers: allNumbers.slice(0, 100)
      }
    });
  } catch (error) {
    console.error(`Erro ao buscar estatísticas da roleta ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas da roleta'
    });
  }
}; 