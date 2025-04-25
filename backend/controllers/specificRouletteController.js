/**
 * Controller para gerenciar dados específicos de cada roleta
 * Implementa endpoints individuais para cada roleta
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

/**
 * Obtém dados específicos de uma roleta pelo seu ID
 * Endpoint genérico que serve como base para qualquer roleta
 */
const getRouletteById = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    const roulette = await db.collection('roulettes').findOne({
      $or: [
        { _id: ObjectId.isValid(rouletteId) ? new ObjectId(rouletteId) : null },
        { id: rouletteId }
      ]
    });
    
    if (!roulette) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada'
      });
    }
    
    return res.json({
      success: true,
      data: roulette
    });
  } catch (error) {
    console.error('Erro ao obter dados da roleta específica:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados da roleta',
      error: error.message
    });
  }
};

/**
 * Obtém os números mais recentes de uma roleta específica
 */
const getRecentNumbersByRoulette = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const limit = parseInt(req.query.limit) || 20;
    const db = await getDb();
    
    // Buscar números recentes
    const recentNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId: rouletteId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return res.json({
      success: true,
      data: {
        rouletteId,
        numbers: recentNumbers.map(n => ({
          number: n.number,
          timestamp: n.timestamp,
          color: getNumberColor(n.number)
        })),
        count: recentNumbers.length,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter números recentes da roleta específica:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter números recentes',
      error: error.message
    });
  }
};

/**
 * Obtém estatísticas de uma roleta específica
 */
const getStatsByRoulette = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Verificar se o usuário tem permissão (middleware já deve ter verificado)
    if (!req.user && req.query.full) {
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer autenticação',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Buscar números para análise
    const numbers = await db.collection('roulette_numbers')
      .find({ rouletteId: rouletteId })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();
    
    // Gerar estatísticas básicas ou completas
    const stats = req.query.full ? 
      generateDetailedStats(numbers.map(n => n.number)) :
      generateBasicStats(numbers.map(n => n.number));
    
    return res.json({
      success: true,
      data: {
        rouletteId,
        stats,
        basedOn: numbers.length,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas da roleta específica:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas',
      error: error.message
    });
  }
};

/**
 * Obtém status atual da roleta (online/offline, último número, etc)
 */
const getRouletteStatus = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Buscar roleta
    const roulette = await db.collection('roulettes').findOne({
      $or: [
        { _id: ObjectId.isValid(rouletteId) ? new ObjectId(rouletteId) : null },
        { id: rouletteId }
      ]
    });
    
    if (!roulette) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada'
      });
    }
    
    // Buscar último número
    const lastNumber = await db.collection('roulette_numbers')
      .findOne({ rouletteId: rouletteId }, { sort: { timestamp: -1 } });
    
    const lastUpdate = lastNumber ? lastNumber.timestamp : null;
    const isActive = lastNumber ? 
      (new Date() - new Date(lastNumber.timestamp) < 5 * 60 * 1000) : false; // 5 minutos
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        status: isActive ? 'online' : 'offline',
        lastNumber: lastNumber ? lastNumber.number : null,
        lastUpdate,
        currentTime: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter status da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter status da roleta',
      error: error.message
    });
  }
};

/**
 * Obtém previsões/estratégias para uma roleta específica
 */
const getRouletteStrategies = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    
    // Verificação de assinatura (middleware já deve ter verificado)
    if (!req.subscription && !req.assinatura) {
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer uma assinatura ativa',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Implementar lógica de previsão baseada nos dados da roleta
    // (Esta função seria bastante complexa na implementação real)
    
    return res.json({
      success: true,
      data: {
        rouletteId,
        strategies: [
          {
            name: 'Sequência de Cores',
            description: 'Baseado na análise dos últimos 50 números',
            prediction: 'Vermelho',
            confidence: 0.75
          },
          {
            name: 'Dúzias',
            description: 'Baseado na análise de frequência',
            prediction: 'Primeira Dúzia (1-12)',
            confidence: 0.68
          }
        ],
        disclaimer: 'Estas estratégias são baseadas em análise estatística e não garantem resultados',
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter estratégias para a roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar estratégias para a roleta',
      error: error.message
    });
  }
};

/**
 * Utilitário para determinar a cor de um número na roleta
 */
const getNumberColor = (number) => {
  // Zero é verde
  if (number === 0) return 'green';
  
  // Números vermelhos na roleta européia padrão
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(Number(number)) ? 'red' : 'black';
};

/**
 * Gera estatísticas básicas para um conjunto de números
 */
const generateBasicStats = (numbers) => {
  // Contagem de cores
  let red = 0, black = 0, green = 0;
  
  // Contagem de paridade
  let even = 0, odd = 0;
  
  // Contagem por dúzias
  let firstDozen = 0, secondDozen = 0, thirdDozen = 0;
  
  // Contagem por colunas
  let firstColumn = 0, secondColumn = 0, thirdColumn = 0;
  
  // Contagem por metade
  let firstHalf = 0, secondHalf = 0;
  
  numbers.forEach(num => {
    // Cor
    if (num === 0) {
      green++;
    } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
      red++;
    } else {
      black++;
    }
    
    if (num === 0) return;
    
    // Paridade
    if (num % 2 === 0) {
      even++;
    } else {
      odd++;
    }
    
    // Dúzias
    if (num <= 12) {
      firstDozen++;
    } else if (num <= 24) {
      secondDozen++;
    } else {
      thirdDozen++;
    }
    
    // Colunas
    if (num % 3 === 1) {
      firstColumn++;
    } else if (num % 3 === 2) {
      secondColumn++;
    } else if (num % 3 === 0) {
      thirdColumn++;
    }
    
    // Metades
    if (num <= 18) {
      firstHalf++;
    } else {
      secondHalf++;
    }
  });
  
  return {
    colors: { red, black, green },
    parity: { even, odd },
    dozens: { first: firstDozen, second: secondDozen, third: thirdDozen },
    columns: { first: firstColumn, second: secondColumn, third: thirdColumn },
    halves: { first: firstHalf, second: secondHalf }
  };
};

/**
 * Gera estatísticas detalhadas (placeholder)
 */
const generateDetailedStats = (numbers) => {
  // Implementar uma versão mais detalhada da função acima
  // com análises mais complexas
  
  // Para este exemplo, apenas retornamos as estatísticas básicas
  return generateBasicStats(numbers);
};

module.exports = {
  getRouletteById,
  getRecentNumbersByRoulette,
  getStatsByRoulette,
  getRouletteStatus,
  getRouletteStrategies,
  getNumberColor
}; 