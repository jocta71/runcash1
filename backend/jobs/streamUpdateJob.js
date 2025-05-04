/**
 * Job para enviar atualizações para streams de eventos
 * Monitora mudanças nos dados e envia para clientes conectados
 */

const { broadcastToResource } = require('../services/streamService');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');

// Cache de último número enviado por roleta
const lastDataSent = new Map();

/**
 * Verifica e envia atualizações para roletas
 */
const checkAndBroadcastRouletteUpdates = async () => {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[STREAM JOB] Não foi possível conectar ao banco de dados');
      return;
    }
    
    // Buscar todas as roletas ativas
    const roulettes = await db.collection('roulettes')
      .find({ status: 'active' })
      .toArray();
    
    console.log(`[STREAM JOB] Verificando atualizações para ${roulettes.length} roletas`);
    
    // Para cada roleta, verificar se há novos dados
    for (const roulette of roulettes) {
      const rouletteId = roulette._id.toString();
      
      // Buscar o número mais recente
      const latestNumber = await db.collection('roulette_numbers')
        .findOne(
          { rouletteId },
          { sort: { timestamp: -1 } }
        );
      
      if (!latestNumber) {
        continue; // Nenhum número encontrado para esta roleta
      }
      
      // Verificar se este é um número novo comparando com o cache
      const lastSentId = lastDataSent.get(rouletteId);
      
      if (!lastSentId || lastSentId !== latestNumber._id.toString()) {
        // Temos um novo número para enviar
        console.log(`[STREAM JOB] Novo número para roleta ${rouletteId}: ${latestNumber.number}`);
        
        // Preparar dados para envio
        const updateData = {
          id: rouletteId,
          type: 'ROULETTE',
          update_type: 'new_number',
          number: {
            value: latestNumber.number,
            color: getNumberColor(latestNumber.number),
            timestamp: latestNumber.timestamp || new Date()
          },
          timestamp: new Date()
        };
        
        // Enviar para todos os clientes conectados
        const clientCount = await broadcastToResource('ROULETTE', rouletteId, updateData);
        
        if (clientCount > 0) {
          console.log(`[STREAM JOB] Enviado para ${clientCount} clientes conectados à roleta ${rouletteId}`);
        }
        
        // Atualizar cache
        lastDataSent.set(rouletteId, latestNumber._id.toString());
      }
    }
  } catch (error) {
    console.error('[STREAM JOB] Erro ao verificar atualizações:', error);
  }
};

/**
 * Determina a cor de um número da roleta
 * @param {Number} number - Número da roleta
 * @returns {String} Cor do número (red, black, green)
 */
const getNumberColor = (number) => {
  if (number === 0 || number === '0' || number === '00') {
    return 'green';
  }
  
  const num = parseInt(number, 10);
  
  // Números vermelhos na roleta europeia padrão
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  
  return redNumbers.includes(num) ? 'red' : 'black';
};

/**
 * Inicia o job de monitoramento e envio de atualizações
 * @param {Number} intervalMs - Intervalo em milissegundos entre verificações (padrão: 5s)
 */
const startStreamUpdateJob = (intervalMs = 5000) => {
  console.log(`[STREAM JOB] Iniciando job de atualização de streams a cada ${intervalMs}ms`);
  
  // Executar uma vez imediatamente
  checkAndBroadcastRouletteUpdates();
  
  // Configurar intervalo
  const jobInterval = setInterval(checkAndBroadcastRouletteUpdates, intervalMs);
  
  // Retornar função para parar o job se necessário
  return () => {
    console.log('[STREAM JOB] Parando job de atualização de streams');
    clearInterval(jobInterval);
  };
};

module.exports = {
  startStreamUpdateJob,
  checkAndBroadcastRouletteUpdates
}; 