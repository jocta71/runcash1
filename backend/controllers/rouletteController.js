/**
 * Controller para gerenciar dados de roletas
 * Implementa respostas diferentes para assinantes e não-assinantes
 */

const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

/**
 * Lista todas as roletas disponíveis para o usuário
 * Limita o número de roletas com base no plano do usuário
 */
const listRoulettes = async (req, res) => {
  try {
    const db = await getDb();
    const roulettes = await db.collection('roulettes').find({}).toArray();
    
    // Se não for usuário autenticado ou não tiver plano, mostrar apenas uma amostra
    if (!req.user) {
      return res.json({
        success: true,
        message: 'Lista limitada de roletas (modo amostra)',
        data: roulettes.slice(0, 3), // Apenas 3 roletas para visitantes
        limited: true
      });
    }
    
    // Se for usuário autenticado, verificar plano
    let limit = 5; // Padrão para plano gratuito
    let limited = true;
    
    // Ajustar limite com base no plano
    if (req.userPlan) {
      switch (req.userPlan.type) {
        case 'BASIC':
          limit = 15;
          break;
        case 'PRO':
        case 'PREMIUM':
          limit = Infinity; // Sem limite
          limited = false;
          break;
        default:
          limit = 5; // FREE
      }
    }
    
    return res.json({
      success: true,
      data: limited ? roulettes.slice(0, limit) : roulettes,
      limited,
      totalCount: roulettes.length,
      availableCount: limited ? limit : roulettes.length
    });
  } catch (error) {
    console.error('Erro ao listar roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter lista de roletas',
      error: error.message
    });
  }
};

/**
 * Obtém dados básicos de uma roleta específica
 * (disponível para todos os usuários)
 */
const getBasicRouletteData = async (req, res) => {
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
    
    // Incluir apenas últimos 5 números para todos os usuários
    const recentNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        provider: roulette.provider,
        status: roulette.status,
        numbers: recentNumbers.map(n => n.number),
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter dados básicos da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados da roleta',
      error: error.message
    });
  }
};

/**
 * Obtém os números recentes de uma roleta
 * (limitado para usuários sem assinatura)
 */
const getRecentNumbers = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Verificar se a roleta existe
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
    
    // Limite baseado no plano do usuário
    let limit = 10; // Padrão para visitantes ou plano gratuito
    
    // Ajustar limite com base no plano, se disponível
    if (req.userPlan) {
      switch (req.userPlan.type) {
        case 'BASIC':
          limit = 20;
          break;
        case 'PRO':
          limit = 50;
          break;
        case 'PREMIUM':
          limit = 100;
          break;
        default:
          limit = 10; // FREE
      }
    }
    
    // Buscar números recentes
    const recentNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        numbers: recentNumbers.map(n => ({
          number: n.number,
          timestamp: n.timestamp,
          color: getNumberColor(n.number)
        })),
        limit,
        isPremium: limit > 10,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter números recentes:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter números recentes da roleta',
      error: error.message
    });
  }
};

/**
 * Obtém dados detalhados da roleta (para assinantes)
 */
const getDetailedRouletteData = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Verificação de segurança adicional - mesmo com middleware, confirmar que o usuário tem permissão
    if (!req.subscription && !req.assinatura) {
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer uma assinatura ativa',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Verificar se a roleta existe
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
    
    // Buscar números completos (sem limite para assinantes)
    const allNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(1000) // Ainda limitar a 1000 por questões de performance
      .toArray();
    
    // Gerar estatísticas avançadas
    const stats = generateRouletteStats(allNumbers.map(n => n.number));
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        provider: roulette.provider,
        status: roulette.status,
        numbers: allNumbers.map(n => ({
          number: n.number,
          timestamp: n.timestamp,
          color: getNumberColor(n.number)
        })),
        stats,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter dados detalhados da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados detalhados da roleta',
      error: error.message
    });
  }
};

/**
 * Obtém estatísticas detalhadas da roleta (para assinantes)
 */
const getRouletteStatistics = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Verificação de segurança adicional - mesmo com middleware, confirmar que o usuário tem permissão
    if (!req.subscription && !req.assinatura) {
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer uma assinatura ativa',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Verificar se a roleta existe
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
    
    // Buscar números para análise
    const allNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();
    
    // Gerar estatísticas avançadas específicas para o sidepanel
    const stats = generateDetailedStats(allNumbers.map(n => n.number));
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        stats,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas da roleta',
      error: error.message
    });
  }
};

/**
 * Obtém dados históricos avançados (para assinantes premium)
 */
const getHistoricalData = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Verificação de segurança adicional - mesmo com middleware, confirmar que o usuário tem permissão
    if (!req.subscription && !req.assinatura) {
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer uma assinatura ativa',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Verificar se o plano é PREMIUM
    const userPlan = req.userPlan?.type || (req.assinatura?.plano === 'anual' ? 'PREMIUM' : null);
    if (userPlan !== 'PREMIUM') {
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer uma assinatura Premium',
        code: 'PREMIUM_REQUIRED'
      });
    }
    
    // Verificar se a roleta existe
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
    
    // Buscar histórico completo para assinantes premium (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const historicalNumbers = await db.collection('roulette_numbers')
      .find({ 
        rouletteId: roulette._id.toString(),
        timestamp: { $gte: thirtyDaysAgo }
      })
      .sort({ timestamp: 1 })
      .toArray();
    
    // Calcular estatísticas avançadas por dia/hora
    const timeStats = generateTimeBasedStats(historicalNumbers);
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        timeStats,
        totalNumbersAnalyzed: historicalNumbers.length,
        period: {
          from: thirtyDaysAgo,
          to: new Date()
        },
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter dados históricos da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados históricos da roleta',
      error: error.message
    });
  }
};

/**
 * Obtém um lote de números (batch) - requer assinatura
 */
const getNumbersBatch = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Verificação de segurança adicional - mesmo com middleware, confirmar que o usuário tem permissão
    if (!req.subscription && !req.assinatura) {
      return res.status(403).json({
        success: false,
        message: 'Este recurso requer uma assinatura ativa',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }
    
    // Verificar se a roleta existe
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
    
    // Limitar batch por plano
    let limit = 500; // Padrão para BASIC
    
    // Ajustar limite com base no plano
    if (req.userPlan) {
      switch (req.userPlan.type) {
        case 'PRO':
          limit = 750;
          break;
        case 'PREMIUM':
          limit = 1000;
          break;
        default:
          limit = 500; // BASIC
      }
    } else if (req.assinatura) {
      // Usar modelo Mongoose
      switch (req.assinatura.plano) {
        case 'trimestral':
          limit = 750; // PRO
          break;
        case 'anual':
          limit = 1000; // PREMIUM
          break;
        default:
          limit = 500; // mensal = BASIC
      }
    }
    
    // Buscar dados
    const numbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        numbers: numbers.map(n => ({
          number: n.number,
          timestamp: n.timestamp,
          color: getNumberColor(n.number)
        })),
        limit,
        planInfo: req.userPlan ? 
          { type: req.userPlan.type, name: req.userPlan.name } : 
          { type: req.assinatura?.plano || 'desconhecido' },
        total: numbers.length,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter lote de números:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter lote de números',
      error: error.message
    });
  }
};

/**
 * Versão limitada/degradada para usuários sem assinatura
 * Mostra uma prévia do que eles teriam com uma assinatura
 */
const getFreePreview = async (req, res) => {
  try {
    const rouletteId = req.params.id;
    const db = await getDb();
    
    // Verificar se a roleta existe
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
    
    // Buscar apenas 5 números mais recentes
    const recentNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId: roulette._id.toString() })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    // Exemplo simplificado de estatísticas para modo preview
    const previewStats = {
      colorDistribution: {
        red: 'Disponível com assinatura',
        black: 'Disponível com assinatura',
        green: 'Disponível com assinatura'
      },
      hotNumbers: [
        { number: '?', frequency: '?' },
        { number: '?', frequency: '?' }
      ],
      coldNumbers: [
        { number: '?', frequency: '?' },
        { number: '?', frequency: '?' }
      ],
      parity: {
        even: 'Disponível com assinatura',
        odd: 'Disponível com assinatura'
      }
    };
    
    return res.json({
      success: true,
      data: {
        id: roulette._id,
        name: roulette.name,
        provider: roulette.provider,
        numbers: recentNumbers.map(n => ({
          number: n.number,
          timestamp: n.timestamp,
          color: getNumberColor(n.number)
        })),
        previewStats,
        isFreePreview: true,
        message: 'Este é um exemplo limitado. Assine um plano para acessar estatísticas completas e histórico detalhado.',
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao obter prévia gratuita:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter prévia gratuita da roleta',
      error: error.message
    });
  }
};

/**
 * Fornece uma amostra limitada de dados de roletas para usuários não autenticados
 * Usado para demonstração e para usuários sem plano
 */
const getSampleRoulettes = async (req, res) => {
  try {
    const db = await getDb();
    const roulettes = await db.collection('roulettes').find({}).limit(3).toArray();
    
    // Limitar os dados retornados para cada roleta (números reduzidos)
    const limitedData = await Promise.all(roulettes.map(async (roulette) => {
      // Buscar apenas os 10 últimos números para cada roleta
      const numbers = await db.collection('roulette_numbers')
        .find({ rouletteId: roulette._id.toString() })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();
      
      // Anexar os números à roleta
      return {
        ...roulette,
        numero: numbers.map(n => ({
          numero: n.number,
          timestamp: n.timestamp,
          cor: n.color || determinarCorNumero(n.number)
        }))
      };
    }));
    
    return res.json({
      success: true,
      message: 'Amostra de dados de roletas',
      data: limitedData,
      sample: true
    });
  } catch (error) {
    console.error('Erro ao obter amostra de roletas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter amostra de roletas',
      error: error.message
    });
  }
};

/**
 * Helper para determinar a cor de um número da roleta
 */
function determinarCorNumero(numero) {
  if (numero === 0) return 'verde';
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
}

/** 
 * FUNÇÕES AUXILIARES
 */

/**
 * Determina a cor de um número da roleta
 */
const getNumberColor = (number) => {
  if (number === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number) ? 'vermelho' : 'preto';
};

/**
 * Gera estatísticas básicas da roleta
 */
const generateRouletteStats = (numbers) => {
  if (!numbers || numbers.length === 0) {
    return {
      empty: true,
      message: 'Sem dados suficientes para análise'
    };
  }
  
  // Estatísticas básicas
  const stats = {
    totalNumbers: numbers.length,
    distribution: {
      red: 0,
      black: 0,
      green: 0
    },
    parity: {
      even: 0,
      odd: 0
    },
    dozens: {
      first: 0,  // 1-12
      second: 0, // 13-24
      third: 0   // 25-36
    },
    segments: {
      low: 0,  // 1-18
      high: 0  // 19-36
    }
  };
  
  // Contar ocorrências de cada número
  const numberCounts = {};
  
  numbers.forEach(num => {
    // Contagem de número
    numberCounts[num] = (numberCounts[num] || 0) + 1;
    
    // Cor
    if (num === 0) {
      stats.distribution.green++;
    } else {
      const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num);
      if (isRed) {
        stats.distribution.red++;
      } else {
        stats.distribution.black++;
      }
    }
    
    // Parity (zero não conta)
    if (num !== 0) {
      if (num % 2 === 0) {
        stats.parity.even++;
      } else {
        stats.parity.odd++;
      }
    }
    
    // Dozens
    if (num >= 1 && num <= 12) {
      stats.dozens.first++;
    } else if (num >= 13 && num <= 24) {
      stats.dozens.second++;
    } else if (num >= 25 && num <= 36) {
      stats.dozens.third++;
    }
    
    // Segments
    if (num >= 1 && num <= 18) {
      stats.segments.low++;
    } else if (num >= 19 && num <= 36) {
      stats.segments.high++;
    }
  });
  
  // Números quentes (mais frequentes) e frios (menos frequentes)
  const sortedNumbers = Object.entries(numberCounts)
    .map(([number, count]) => ({ number: parseInt(number), count }))
    .sort((a, b) => b.count - a.count);
  
  stats.hotNumbers = sortedNumbers.slice(0, 5);
  stats.coldNumbers = sortedNumbers.slice(-5).reverse();
  
  return stats;
};

/**
 * Gera estatísticas detalhadas para o sidepanel
 */
const generateDetailedStats = (numbers) => {
  const basicStats = generateRouletteStats(numbers);
  
  // Adicionar estatísticas mais avançadas para o sidepanel
  const detailedStats = {
    ...basicStats,
    
    // Sequências de cores
    colorSequences: {
      redStreaks: findLongestStreak(numbers, num => getNumberColor(num) === 'vermelho'),
      blackStreaks: findLongestStreak(numbers, num => getNumberColor(num) === 'preto')
    },
    
    // Sequências de paridade
    paritySequences: {
      evenStreaks: findLongestStreak(numbers, num => num !== 0 && num % 2 === 0),
      oddStreaks: findLongestStreak(numbers, num => num !== 0 && num % 2 !== 0)
    },
    
    // Padrões de bets 
    patterns: analyzePatterns(numbers)
  };
  
  return detailedStats;
};

/**
 * Gera estatísticas baseadas em tempo
 */
const generateTimeBasedStats = (numbersWithTimestamp) => {
  // Agrupar por dia
  const dayGroups = {};
  
  numbersWithTimestamp.forEach(item => {
    const date = new Date(item.timestamp);
    const day = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!dayGroups[day]) {
      dayGroups[day] = [];
    }
    
    dayGroups[day].push(item.number);
  });
  
  // Calcular estatísticas por dia
  const dailyStats = {};
  
  Object.entries(dayGroups).forEach(([day, nums]) => {
    dailyStats[day] = generateRouletteStats(nums);
    dailyStats[day].count = nums.length;
  });
  
  return {
    dailyStats,
    totalDays: Object.keys(dayGroups).length
  };
};

/**
 * Encontra a maior sequência de números que satisfazem uma condição
 */
const findLongestStreak = (numbers, conditionFn) => {
  let currentStreak = 0;
  let longestStreak = 0;
  let streaks = [];
  
  numbers.forEach((num, index) => {
    if (conditionFn(num)) {
      currentStreak++;
      
      if (index === numbers.length - 1) {
        streaks.push(currentStreak);
      }
    } else {
      if (currentStreak > 0) {
        streaks.push(currentStreak);
        currentStreak = 0;
      }
    }
    
    longestStreak = Math.max(longestStreak, currentStreak);
  });
  
  return {
    longest: longestStreak,
    current: currentStreak,
    allStreaks: streaks.filter(s => s > 1).slice(0, 5) // Top 5 sequências
  };
};

/**
 * Analisa padrões nos números
 */
const analyzePatterns = (numbers) => {
  // Exemplo simples - implementar algoritmos mais avançados conforme necessário
  return {
    repeatingNumbers: findRepeatingPatterns(numbers),
    alternatingColors: checkAlternatingColors(numbers)
  };
};

/**
 * Encontra padrões de repetição de números
 */
const findRepeatingPatterns = (numbers) => {
  const repeats = [];
  
  for (let i = 0; i < numbers.length - 1; i++) {
    if (numbers[i] === numbers[i + 1]) {
      repeats.push({
        number: numbers[i],
        position: i
      });
    }
  }
  
  return {
    count: repeats.length,
    examples: repeats.slice(0, 3)
  };
};

/**
 * Verifica padrões de alternância de cores
 */
const checkAlternatingColors = (numbers) => {
  let alternatingCount = 0;
  
  for (let i = 0; i < numbers.length - 1; i++) {
    const currentColor = getNumberColor(numbers[i]);
    const nextColor = getNumberColor(numbers[i + 1]);
    
    if (currentColor !== nextColor) {
      alternatingCount++;
    }
  }
  
  return {
    count: alternatingCount,
    percentage: Math.round((alternatingCount / (numbers.length - 1)) * 100)
  };
};

module.exports = {
  listRoulettes,
  getBasicRouletteData,
  getRecentNumbers,
  getDetailedRouletteData,
  getRouletteStatistics,
  getHistoricalData,
  getNumbersBatch,
  getFreePreview,
  getSampleRoulettes
}; 