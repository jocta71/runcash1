const { encryptRouletteData } = require('./utils/crypto');
const { broadcastToTable } = require('./utils/stream');

// Armazena os contadores de eventos por mesa
const eventCounters = new Map();

// Armazena os últimos resultados por mesa
const lastResults = new Map();

/**
 * Obtém e incrementa o contador de eventos para uma mesa
 * @param {string} tableId - ID da mesa
 * @returns {number} - Próximo ID de evento
 */
const getNextEventId = (tableId) => {
  if (!eventCounters.has(tableId)) {
    eventCounters.set(tableId, 0);
  }
  
  const nextId = eventCounters.get(tableId) + 1;
  eventCounters.set(tableId, nextId);
  
  return nextId;
};

/**
 * Processa e transmite um novo resultado da roleta
 * @param {string} tableId - ID da mesa/sala da roleta
 * @param {Object} resultData - Dados do resultado (número, cor, etc)
 */
const processRouletteResult = async (tableId, resultData) => {
  try {
    // Armazena o último resultado
    lastResults.set(tableId, resultData);
    
    // Criptografa os dados
    const encryptedData = await encryptRouletteData(resultData);
    
    // Obtém o próximo ID de evento
    const eventId = getNextEventId(tableId);
    
    // Transmite para todos os clientes conectados
    broadcastToTable(tableId, 'update', encryptedData, eventId);
    
    console.log(`Resultado processado para mesa ${tableId}, evento #${eventId}`);
    
    return { success: true, eventId };
  } catch (error) {
    console.error(`Erro ao processar resultado da roleta para mesa ${tableId}:`, error);
    throw error;
  }
};

/**
 * Obtém o último resultado conhecido para uma mesa
 * @param {string} tableId - ID da mesa/sala da roleta
 * @returns {Object|null} - Último resultado ou null se não houver
 */
const getLastResult = (tableId) => {
  return lastResults.get(tableId) || null;
};

/**
 * Obtém histórico de resultados para uma mesa
 * Esta é uma implementação simplificada - em produção, 
 * você buscaria esses dados de um banco de dados
 * 
 * @param {string} tableId - ID da mesa
 * @param {number} limit - Quantidade máxima de resultados
 * @returns {Array} - Array de resultados históricos
 */
const getResultHistory = async (tableId, limit = 20) => {
  // Em uma implementação real, você buscaria do banco de dados
  // Aqui estamos apenas simulando um histórico
  
  // Esta é uma implementação fictícia
  const mockHistory = [];
  
  const lastResult = lastResults.get(tableId);
  if (lastResult) {
    mockHistory.push(lastResult);
  }
  
  return mockHistory;
};

/**
 * Simula a geração de um resultado aleatório da roleta
 * Em produção, este método seria substituído por uma 
 * integração real com o provedor da roleta
 * 
 * @returns {Object} - Resultado simulado da roleta
 */
const generateRandomResult = () => {
  // Gera um número entre 0 e 36
  const number = Math.floor(Math.random() * 37);
  
  // Determina a cor
  let color;
  if (number === 0) {
    color = 'green';
  } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number)) {
    color = 'red';
  } else {
    color = 'black';
  }
  
  // Determina paridade e faixa
  const isEven = number !== 0 && number % 2 === 0;
  const range = number === 0 ? 'zero' : (number <= 18 ? 'low' : 'high');
  
  return {
    number,
    color,
    isEven,
    range,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  processRouletteResult,
  getLastResult,
  getResultHistory,
  generateRandomResult
}; 