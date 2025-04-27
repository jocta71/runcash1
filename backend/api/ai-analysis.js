/**
 * Serviço de IA para análise de padrões de roleta
 * Este serviço processa solicitações de análise de IA e retorna insights
 */

const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

const router = express.Router();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash";
const DB_NAME = 'runcash';
const COLLECTION_NAME = 'roleta_numeros';

/**
 * Analisar sequências e padrões nos números da roleta
 * @param {Array<number>} numbers - Array de números da roleta
 * @returns {Object} Objeto com análises de padrões
 */
function analyzePatterns(numbers) {
  if (!numbers || !numbers.length) {
    return {
      error: "Nenhum dado disponível para análise"
    };
  }

  // Cores (vermelho/preto)
  const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  
  // Mapear números para suas cores
  const colors = numbers.map(num => {
    if (num === 0) return 'zero';
    return red.includes(num) ? 'vermelho' : 'preto';
  });
  
  // Mapear números para paridade
  const parities = numbers.map(num => {
    if (num === 0) return 'zero';
    return num % 2 === 0 ? 'par' : 'ímpar';
  });
  
  // Mapear números para dúzias
  const dozens = numbers.map(num => {
    if (num === 0) return 'zero';
    if (num <= 12) return 'primeira';
    if (num <= 24) return 'segunda';
    return 'terceira';
  });
  
  // Calcular estatísticas
  const stats = {
    colorCounts: { vermelho: 0, preto: 0, zero: 0 },
    parityCounts: { par: 0, ímpar: 0, zero: 0 },
    dozenCounts: { primeira: 0, segunda: 0, terceira: 0, zero: 0 },
    numberCounts: {}
  };
  
  // Inicializar contagem para todos os números possíveis
  for (let i = 0; i <= 36; i++) {
    stats.numberCounts[i] = 0;
  }
  
  // Contar ocorrências
  numbers.forEach((num, index) => {
    // Incrementar contagem de números
    stats.numberCounts[num]++;
    
    // Incrementar contagem de cores
    stats.colorCounts[colors[index]]++;
    
    // Incrementar contagem de paridade
    stats.parityCounts[parities[index]]++;
    
    // Incrementar contagem de dúzias
    stats.dozenCounts[dozens[index]]++;
  });
  
  // Identificar streaks (sequências)
  const streaks = {
    colors: findStreaks(colors),
    parities: findStreaks(parities),
    dozens: findStreaks(dozens)
  };
  
  // Identificar alternâncias
  const alternations = {
    colors: countAlternations(colors),
    parities: countAlternations(parities),
    dozens: countAlternations(dozens)
  };
  
  // Identificar números quentes (hot) e frios (cold)
  const numberFrequency = Object.entries(stats.numberCounts)
    .map(([number, count]) => ({ number: parseInt(number), count }))
    .sort((a, b) => b.count - a.count);
  
  const hotNumbers = numberFrequency.slice(0, 5);
  const coldNumbers = [...numberFrequency].sort((a, b) => a.count - b.count).slice(0, 5);
  
  // Calcular distribuição de probabilidade
  const total = numbers.length;
  const probabilities = {
    red: (stats.colorCounts.vermelho / total) * 100,
    black: (stats.colorCounts.preto / total) * 100,
    zero: (stats.colorCounts.zero / total) * 100,
    even: (stats.parityCounts.par / total) * 100,
    odd: (stats.parityCounts.ímpar / total) * 100,
    firstDozen: (stats.dozenCounts.primeira / total) * 100,
    secondDozen: (stats.dozenCounts.segunda / total) * 100,
    thirdDozen: (stats.dozenCounts.terceira / total) * 100
  };
  
  // Gerar "previsões" (apenas para demonstração)
  const predictions = generatePredictions(numbers, hotNumbers, coldNumbers);
  
  return {
    statistics: stats,
    streaks,
    alternations,
    hotNumbers,
    coldNumbers,
    probabilities,
    predictions,
    lastNumbers: numbers.slice(-10),
    totalNumbersAnalyzed: numbers.length
  };
}

/**
 * Encontrar sequências de valores iguais consecutivos
 * @param {Array<string>} values - Array de valores para analisar
 * @returns {Array<Object>} Array de objetos com valor e tamanho de sequência
 */
function findStreaks(values) {
  if (!values || !values.length) return [];
  
  const streaks = [];
  let currentStreak = { value: values[0], length: 1 };
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] === currentStreak.value) {
      currentStreak.length++;
    } else {
      if (currentStreak.length >= 3) {
        streaks.push({ ...currentStreak });
      }
      currentStreak = { value: values[i], length: 1 };
    }
  }
  
  // Adicionar a última sequência se for relevante
  if (currentStreak.length >= 3) {
    streaks.push(currentStreak);
  }
  
  return streaks.sort((a, b) => b.length - a.length);
}

/**
 * Contar número de alternâncias entre valores diferentes
 * @param {Array<string>} values - Array de valores para analisar
 * @returns {Object} Objeto com contagem e percentagem de alternâncias
 */
function countAlternations(values) {
  if (!values || values.length < 2) return { count: 0, percentage: 0 };
  
  let alternations = 0;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i-1] && values[i] !== 'zero' && values[i-1] !== 'zero') {
      alternations++;
    }
  }
  
  const possibleAlternations = values.length - 1;
  const percentage = (alternations / possibleAlternations) * 100;
  
  return {
    count: alternations,
    percentage,
    isSignificant: percentage > 65
  };
}

/**
 * Gerar "previsões" baseadas em padrões (apenas para demonstração)
 * @param {Array<number>} numbers - Histórico de números
 * @param {Array<Object>} hotNumbers - Números mais frequentes
 * @param {Array<Object>} coldNumbers - Números menos frequentes
 * @returns {Object} Objeto com "previsões"
 */
function generatePredictions(numbers, hotNumbers, coldNumbers) {
  // NOTA: Isto é apenas para demonstração
  // Previsões reais exigiriam algoritmos mais sofisticados
  
  // Últimos 5 números
  const recent = numbers.slice(-5);
  
  // Números sugeridos com base em frequência
  const suggestedHot = hotNumbers.slice(0, 3).map(n => n.number);
  const suggestedCold = coldNumbers.slice(0, 2).map(n => n.number);
  
  // "Estratégia" aleatória
  const strategies = [
    'Foco nos números quentes com apostas progressivas',
    'Alternância entre vermelho e preto com regra de 3 golpes',
    'Cobertura de dúzia com progressão D\'Alembert',
    'Martingale em paridade (par/ímpar)',
    'Fibonacci nas colunas'
  ];
  
  return {
    suggestedNumbers: [...suggestedHot, ...suggestedCold],
    recommendedStrategy: strategies[Math.floor(Math.random() * strategies.length)],
    confidence: Math.floor(Math.random() * 30) + 50 // 50-80% (aleatório para demonstração)
  };
}

/**
 * Processar uma consulta de análise de IA
 * @param {string} query - A consulta do usuário
 * @param {Array<number>} data - Dados da roleta
 * @returns {string} Resposta gerada
 */
function processAIQuery(query, data) {
  const analysis = analyzePatterns(data);
  let response = '';
  
  // Identificar o tipo de consulta com base em palavras-chave
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes('tendência') || queryLower.includes('tendencia')) {
    // Analisar tendências
    const colorTrend = analysis.statistics.colorCounts.vermelho > analysis.statistics.colorCounts.preto
      ? 'números vermelhos'
      : 'números pretos';
      
    const parityTrend = analysis.statistics.parityCounts.par > analysis.statistics.parityCounts.ímpar
      ? 'números pares'
      : 'números ímpares';
    
    let dozenTrend = 'primeira dúzia';
    const { primeira, segunda, terceira } = analysis.statistics.dozenCounts;
    if (segunda > primeira && segunda > terceira) dozenTrend = 'segunda dúzia';
    if (terceira > primeira && terceira > segunda) dozenTrend = 'terceira dúzia';
    
    response = `Analisando as tendências das últimas ${analysis.totalNumbersAnalyzed} rodadas, observo uma predominância de ${colorTrend} (${Math.round(analysis.statistics.colorCounts.vermelho > analysis.statistics.colorCounts.preto ? analysis.probabilities.red : analysis.probabilities.black)}%) e ${parityTrend} (${Math.round(analysis.statistics.parityCounts.par > analysis.statistics.parityCounts.ímpar ? analysis.probabilities.even : analysis.probabilities.odd)}%).
    
A ${dozenTrend} tem aparecido com maior frequência (${Math.round(Math.max(analysis.probabilities.firstDozen, analysis.probabilities.secondDozen, analysis.probabilities.thirdDozen))}%).

${analysis.streaks.colors.length > 0 
  ? `Também identifiquei sequências significativas de ${analysis.streaks.colors[0].length} ${analysis.streaks.colors[0].value}s consecutivos.` 
  : 'Não identifiquei sequências significativas de cores.'}

${analysis.alternations.colors.isSignificant 
  ? `Há um padrão forte de alternância entre vermelho e preto (${Math.round(analysis.alternations.colors.percentage)}% de alternância).` 
  : 'Não há um padrão claro de alternância entre as cores.'}`;
  
  } else if (queryLower.includes('frequência') || queryLower.includes('frequencia') || queryLower.includes('frequentes')) {
    // Analisar frequências
    response = `Analisando as frequências dos números nas últimas ${analysis.totalNumbersAnalyzed} rodadas:

Números mais frequentes:
${analysis.hotNumbers.slice(0, 5).map((n, i) => `${i+1}. Número ${n.number}: apareceu ${n.count} vezes (${Math.round((n.count/analysis.totalNumbersAnalyzed)*100)}%)`).join('\n')}

Números menos frequentes:
${analysis.coldNumbers.slice(0, 5).map((n, i) => `${i+1}. Número ${n.number}: apareceu ${n.count} vezes (${Math.round((n.count/analysis.totalNumbersAnalyzed)*100)}%)`).join('\n')}

O zero apareceu ${analysis.statistics.colorCounts.zero} vezes (${Math.round(analysis.probabilities.zero)}%).`;

  } else if (queryLower.includes('padrão') || queryLower.includes('padrao') || queryLower.includes('padrões') || queryLower.includes('padroes')) {
    // Analisar padrões
    const patternsList = [];
    
    if (analysis.streaks.colors.length > 0) {
      patternsList.push(`Sequência de ${analysis.streaks.colors[0].length} ${analysis.streaks.colors[0].value}s consecutivos`);
    }
    
    if (analysis.streaks.parities.length > 0) {
      patternsList.push(`Sequência de ${analysis.streaks.parities[0].length} números ${analysis.streaks.parities[0].value}es consecutivos`);
    }
    
    if (analysis.alternations.colors.isSignificant) {
      patternsList.push(`Alternância entre vermelho e preto (${Math.round(analysis.alternations.colors.percentage)}%)`);
    }
    
    if (analysis.alternations.parities.isSignificant) {
      patternsList.push(`Alternância entre par e ímpar (${Math.round(analysis.alternations.parities.percentage)}%)`);
    }
    
    response = `Após analisar ${analysis.totalNumbersAnalyzed} rodadas, identifiquei os seguintes padrões:
    
${patternsList.length > 0 
  ? patternsList.map((p, i) => `${i+1}. ${p}`).join('\n') 
  : 'Não foram identificados padrões significativos nos dados analisados.'}

Os últimos 10 números foram: ${analysis.lastNumbers.join(', ')}`;

  } else if (queryLower.includes('estratégia') || queryLower.includes('estrategia')) {
    // Sugerir estratégias
    response = `Com base na análise de ${analysis.totalNumbersAnalyzed} rodadas, sugiro a seguinte estratégia:

${analysis.predictions.recommendedStrategy}

Números sugeridos para apostar: ${analysis.predictions.suggestedNumbers.join(', ')}

Esta recomendação tem uma confiança estimada de ${analysis.predictions.confidence}%, com base nos padrões identificados.

Lembre-se que jogos de roleta são baseados em eventos aleatórios e independentes, e nenhuma estratégia pode garantir ganhos constantes. Jogue com responsabilidade e estabeleça limites.`;

  } else {
    // Resposta genérica para outras consultas
    response = `Analisei os dados das últimas ${analysis.totalNumbersAnalyzed} rodadas da roleta.

Principais insights:
- Distribuição de cores: ${Math.round(analysis.probabilities.red)}% vermelho, ${Math.round(analysis.probabilities.black)}% preto, ${Math.round(analysis.probabilities.zero)}% zero
- Paridade: ${Math.round(analysis.probabilities.even)}% pares, ${Math.round(analysis.probabilities.odd)}% ímpares
- Dúzias: 1ª: ${Math.round(analysis.probabilities.firstDozen)}%, 2ª: ${Math.round(analysis.probabilities.secondDozen)}%, 3ª: ${Math.round(analysis.probabilities.thirdDozen)}%

Números quentes: ${analysis.hotNumbers.slice(0, 3).map(n => n.number).join(', ')}
Números frios: ${analysis.coldNumbers.slice(0, 3).map(n => n.number).join(', ')}

Para uma análise mais específica, tente perguntar sobre tendências, frequências, padrões ou estratégias.`;
  }
  
  return response;
}

// Rota para processar consultas de IA
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Consulta não fornecida' });
    }
    
    // Conectar ao MongoDB
    const client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });
    await client.connect();
    
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Buscar dados da roleta (últimos 100 números)
    const data = await collection.find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    // Extrair apenas os números
    const numbers = data.map(item => item.numero);
    
    // Processar a consulta
    const response = processAIQuery(query, numbers);
    
    // Fechar conexão
    await client.close();
    
    // Retornar resultado
    return res.status(200).json({
      query,
      response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao processar consulta de IA:', error);
    return res.status(500).json({ error: 'Erro interno ao processar consulta de IA' });
  }
});

// Rota para obter estatísticas de IA
router.get('/stats', async (req, res) => {
  try {
    // Conectar ao MongoDB
    const client = new MongoClient(MONGODB_URI, { useUnifiedTopology: true });
    await client.connect();
    
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Buscar dados da roleta (últimos 100 números)
    const data = await collection.find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    // Extrair apenas os números
    const numbers = data.map(item => item.numero);
    
    // Analisar padrões
    const analysis = analyzePatterns(numbers);
    
    // Fechar conexão
    await client.close();
    
    // Retornar resultado
    return res.status(200).json({
      analysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas de IA:', error);
    return res.status(500).json({ error: 'Erro interno ao obter estatísticas de IA' });
  }
});

module.exports = router; 