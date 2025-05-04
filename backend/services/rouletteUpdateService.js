/**
 * Serviço para atualização em tempo real dos dados das roletas
 * Envia atualizações para todos os clientes conectados via SSE
 */

const getDb = require('./database');
const { broadcastToRoulette } = require('../controllers/streamController');

/**
 * Inicializa o serviço de atualizações em tempo real
 */
const initRouletteUpdateService = () => {
  console.log('[RouletteService] Iniciando serviço de atualização em tempo real');
  
  // Configurar intervalos de verificação
  setupRegularCheck();
};

/**
 * Configura verificações regulares para novas atualizações
 */
const setupRegularCheck = () => {
  // Verificar a cada 5 segundos por novos números
  setInterval(async () => {
    try {
      await checkForNewNumbers();
    } catch (error) {
      console.error('[RouletteService] Erro na verificação de novos números:', error);
    }
  }, 5000);
};

/**
 * Verifica se há novos números para as roletas
 */
const checkForNewNumbers = async () => {
  try {
    const db = await getDb();
    
    // Buscar todas as roletas ativas
    const roulettes = await db.collection('roulettes')
      .find({ status: 'online' })
      .toArray();
    
    // Para cada roleta, verificar últimos números
    for (const roulette of roulettes) {
      const rouletteId = roulette._id.toString();
      
      // Buscar o último número desta roleta que já enviamos
      const lastProcessedKey = `last_processed_${rouletteId}`;
      let lastProcessedTimestamp = global[lastProcessedKey] || 0;
      
      // Buscar novos números desde o último processado
      const newNumbers = await db.collection('roulette_numbers')
        .find({ 
          rouletteId: rouletteId,
          timestamp: { $gt: new Date(lastProcessedTimestamp) }
        })
        .sort({ timestamp: 1 })
        .toArray();
      
      // Se encontramos novos números
      if (newNumbers.length > 0) {
        console.log(`[RouletteService] Encontrados ${newNumbers.length} novos números para roleta ${rouletteId}`);
        
        // Processar cada número em ordem cronológica
        for (const numberData of newNumbers) {
          // Preparar dados para envio
          const broadcastData = {
            id: rouletteId,
            number: numberData.number,
            timestamp: numberData.timestamp,
            color: getNumberColor(numberData.number)
          };
          
          // Enviar para todos os clientes conectados a esta roleta
          broadcastToRoulette(rouletteId, broadcastData);
          
          // Atualizar último timestamp processado
          global[lastProcessedKey] = new Date(numberData.timestamp).getTime();
        }
      }
    }
  } catch (error) {
    console.error('[RouletteService] Erro ao processar atualizações:', error);
  }
};

/**
 * Registra manualmente um novo número para uma roleta
 * e envia para todos os clientes conectados
 * @param {String} rouletteId - ID da roleta
 * @param {Number} number - Número sorteado
 */
const addNewNumber = async (rouletteId, number) => {
  try {
    const db = await getDb();
    
    // Criar registro do novo número
    const timestamp = new Date();
    const color = getNumberColor(number);
    
    // Salvar no banco de dados
    await db.collection('roulette_numbers').insertOne({
      rouletteId,
      number,
      timestamp,
      color
    });
    
    // Preparar dados para broadcast
    const broadcastData = {
      id: rouletteId,
      number,
      timestamp,
      color
    };
    
    // Enviar para todos os clientes conectados
    broadcastToRoulette(rouletteId, broadcastData);
    
    return { success: true, data: broadcastData };
  } catch (error) {
    console.error('[RouletteService] Erro ao adicionar novo número:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Determina a cor do número da roleta
 */
function getNumberColor(number) {
  if (number === 0) return 'green';
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number) ? 'red' : 'black';
}

module.exports = {
  initRouletteUpdateService,
  addNewNumber
}; 