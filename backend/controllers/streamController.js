/**
 * Controlador para streaming de dados em tempo real (SSE)
 * Implementa Server-Sent Events para enviar atualizações em tempo real
 */

const getDb = require('../services/database');
const { encryptData } = require('../utils/cryptoService');

// Armazenar clientes conectados
const connectedClients = {
  // Por roleta
  byRoulette: {},
  // Global (todos os clientes)
  global: new Set()
};

/**
 * Inicia streaming de dados em tempo real para uma roleta específica
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const streamRouletteData = async (req, res) => {
  const rouletteId = req.params.id;
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Verificar formato de streaming (parâmetro k)
  const streamType = req.query.k || '1';
  
  // Configurar headers SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Necessário para o Nginx não fazer buffer
  });
  
  console.log(`[STREAM ${requestId}] Novo cliente conectado para roleta ${rouletteId}, formato ${streamType}`);
  
  // Enviar mensagem inicial para manter a conexão
  const initialData = {
    id: rouletteId,
    status: 'connected',
    timestamp: Date.now(),
    type: streamType
  };
  
  // Criptografar e enviar dados iniciais
  sendSSEEvent(res, 'update', encryptData(initialData));
  
  // Registrar cliente para receber atualizações
  if (!connectedClients.byRoulette[rouletteId]) {
    connectedClients.byRoulette[rouletteId] = new Set();
  }
  
  // Adicionar este cliente à lista da roleta específica
  connectedClients.byRoulette[rouletteId].add(res);
  
  // Adicionar à lista global
  connectedClients.global.add(res);
  
  // Enviar atualizações iniciais com dados recentes
  try {
    // Buscar últimos números da roleta
    const db = await getDb();
    const recentNumbers = await db.collection('roulette_numbers')
      .find({ rouletteId })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();
    
    if (recentNumbers.length > 0) {
      // Enviar cada número como um evento separado para simular histórico
      for (let i = recentNumbers.length - 1; i >= 0; i--) {
        const numData = {
          id: rouletteId,
          number: recentNumbers[i].number,
          timestamp: recentNumbers[i].timestamp,
          color: getNumberColor(recentNumbers[i].number)
        };
        
        // Enviar evento com dados criptografados
        sendSSEEvent(res, 'update', encryptData(numData));
        
        // Pequeno delay entre eventos para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error(`[STREAM ${requestId}] Erro ao buscar números recentes:`, error);
  }
  
  // Cleanup quando o cliente desconectar
  req.on('close', () => {
    console.log(`[STREAM ${requestId}] Cliente desconectado da roleta ${rouletteId}`);
    
    // Remover das listas
    if (connectedClients.byRoulette[rouletteId]) {
      connectedClients.byRoulette[rouletteId].delete(res);
      
      // Limpar set vazio
      if (connectedClients.byRoulette[rouletteId].size === 0) {
        delete connectedClients.byRoulette[rouletteId];
      }
    }
    
    connectedClients.global.delete(res);
  });
};

/**
 * Enviar atualização para todos os clientes conectados a uma roleta específica
 * @param {String} rouletteId - ID da roleta
 * @param {Object} data - Dados a serem enviados
 */
const broadcastToRoulette = (rouletteId, data) => {
  if (!connectedClients.byRoulette[rouletteId]) {
    return; // Nenhum cliente conectado para esta roleta
  }
  
  // Criptografar dados uma vez
  const encryptedData = encryptData(data);
  
  // Enviar para todos os clientes conectados a esta roleta
  connectedClients.byRoulette[rouletteId].forEach(client => {
    try {
      sendSSEEvent(client, 'update', encryptedData);
    } catch (error) {
      console.error(`Erro ao enviar evento para cliente: ${error.message}`);
      // Client provavelmente desconectou mas não foi removido corretamente
      connectedClients.byRoulette[rouletteId].delete(client);
      connectedClients.global.delete(client);
    }
  });
  
  console.log(`[BROADCAST] Enviado evento para ${connectedClients.byRoulette[rouletteId].size} clientes da roleta ${rouletteId}`);
};

/**
 * Envia um evento SSE para o cliente
 * @param {Object} res - Objeto de resposta Express
 * @param {String} event - Nome do evento
 * @param {String} data - Dados a serem enviados (já criptografados)
 */
const sendSSEEvent = (res, event, data) => {
  try {
    res.write(`event: ${event}\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: ${data}\n\n`);
  } catch (error) {
    console.error('Erro ao enviar evento SSE:', error);
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
  streamRouletteData,
  broadcastToRoulette,
  connectedClients
}; 