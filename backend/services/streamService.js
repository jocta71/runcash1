/**
 * Serviço de streaming para enviar eventos em tempo real
 * Implementa Server-Sent Events (SSE) com gerenciamento de clientes
 */

const { encryptData } = require('../utils/encryption');
const getDb = require('./database');
const { ObjectId } = require('mongodb');

// Armazenamento de clientes conectados por tipo e ID de recurso
const connectedClients = {
  // Formato: { gameType: { gameId: [clientFn1, clientFn2, ...] } }
};

// Contador de eventos para assegurar ordem
let eventCounter = 1;

/**
 * Adiciona um cliente ao registro para receber atualizações
 * @param {String} resourceType - Tipo de recurso (ex: 'ROULETTE')
 * @param {String} resourceId - ID do recurso
 * @param {Function} sendEventFn - Função para enviar evento para este cliente
 * @returns {String} ID único do cliente para gerenciamento
 */
const registerClient = (resourceType, resourceId, sendEventFn) => {
  const clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Normalizar tipo de recurso (maiúsculas) e criar estrutura se não existir
  const type = resourceType.toUpperCase();
  
  if (!connectedClients[type]) {
    connectedClients[type] = {};
  }
  
  if (!connectedClients[type][resourceId]) {
    connectedClients[type][resourceId] = [];
  }
  
  // Registrar cliente com seu ID e função de envio
  connectedClients[type][resourceId].push({
    id: clientId,
    send: sendEventFn
  });
  
  console.log(`[STREAM] Cliente ${clientId} registrado para ${type}/${resourceId}. Total: ${connectedClients[type][resourceId].length}`);
  
  return clientId;
};

/**
 * Remove um cliente do registro
 * @param {String} clientId - ID do cliente a remover
 */
const unregisterClient = (clientId) => {
  // Buscar cliente em todas as categorias e recursos
  let removed = false;
  
  Object.keys(connectedClients).forEach(type => {
    Object.keys(connectedClients[type]).forEach(resourceId => {
      const initialLength = connectedClients[type][resourceId].length;
      
      // Filtrar para remover o cliente específico
      connectedClients[type][resourceId] = connectedClients[type][resourceId]
        .filter(client => client.id !== clientId);
      
      // Verificar se removeu algo
      if (initialLength > connectedClients[type][resourceId].length) {
        removed = true;
        console.log(`[STREAM] Cliente ${clientId} removido de ${type}/${resourceId}. Restantes: ${connectedClients[type][resourceId].length}`);
        
        // Limpar recursos vazios para evitar vazamento de memória
        if (connectedClients[type][resourceId].length === 0) {
          delete connectedClients[type][resourceId];
          console.log(`[STREAM] Removido recurso vazio ${type}/${resourceId}`);
          
          // Se não há mais recursos deste tipo, remover o tipo
          if (Object.keys(connectedClients[type]).length === 0) {
            delete connectedClients[type];
            console.log(`[STREAM] Removido tipo vazio ${type}`);
          }
        }
      }
    });
  });
  
  if (!removed) {
    console.log(`[STREAM] Cliente ${clientId} não encontrado para remoção`);
  }
  
  return removed;
};

/**
 * Envia dados para todos os clientes registrados para um recurso específico
 * @param {String} resourceType - Tipo de recurso
 * @param {String} resourceId - ID do recurso
 * @param {Object} data - Dados a serem enviados
 */
const broadcastToResource = async (resourceType, resourceId, data) => {
  const type = resourceType.toUpperCase();
  
  // Verificar se há clientes registrados
  if (!connectedClients[type] || !connectedClients[type][resourceId]) {
    return 0; // Nenhum cliente para enviar
  }
  
  console.log(`[STREAM] Enviando atualização para ${connectedClients[type][resourceId].length} clientes em ${type}/${resourceId}`);
  
  // Preparar dados com ID de evento incremental
  const eventData = {
    ...data,
    event_id: eventCounter++,
    timestamp: Date.now()
  };
  
  // Criptografar dados para envio seguro
  const encryptedData = encryptData(eventData);
  
  // Array para registrar erros de envio
  const errors = [];
  
  // Enviar para cada cliente
  for (const client of connectedClients[type][resourceId]) {
    try {
      await client.send(encryptedData);
    } catch (error) {
      console.error(`[STREAM] Erro ao enviar para cliente ${client.id}:`, error.message);
      errors.push(client.id);
    }
  }
  
  // Remover clientes com erro
  errors.forEach(clientId => unregisterClient(clientId));
  
  return connectedClients[type][resourceId].length;
};

/**
 * Obtém dados iniciais para um determinado jogo/recurso
 * @param {String} gameType - Tipo de jogo (ex: ROULETTE)
 * @param {String} gameId - ID do jogo
 * @returns {Object} Dados iniciais do jogo
 */
const getGameInitialData = async (gameType, gameId) => {
  try {
    const db = await getDb();
    const type = gameType.toUpperCase();
    
    // Dados diferentes para cada tipo de jogo
    if (type === 'ROULETTE') {
      // Busca a roleta pelo ID
      const roulette = await db.collection('roulettes').findOne({
        $or: [
          { _id: ObjectId.isValid(gameId) ? new ObjectId(gameId) : null },
          { id: gameId }
        ]
      });
      
      if (!roulette) {
        throw new Error(`Roleta não encontrada: ${gameId}`);
      }
      
      // Buscar últimos números (até 50)
      const recentNumbers = await db.collection('roulette_numbers')
        .find({ rouletteId: roulette._id.toString() })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();
        
      // Processar estatísticas e dados adicinais
      return {
        id: roulette._id.toString(),
        name: roulette.name,
        provider: roulette.provider,
        type: 'ROULETTE',
        status: roulette.status || 'active',
        numbers: recentNumbers.map(n => ({
          number: n.number,
          timestamp: n.timestamp,
          color: getNumberColor(n.number)
        })),
        lastUpdated: new Date(),
        initialLoad: true
      };
    }
    
    // Se tipo desconhecido, retornar dados genéricos
    return {
      id: gameId,
      type: gameType,
      status: 'unknown',
      lastUpdated: new Date(),
      initialLoad: true,
      message: 'Tipo de jogo não suportado'
    };
  } catch (error) {
    console.error(`[STREAM] Erro ao obter dados iniciais para ${gameType}/${gameId}:`, error);
    return {
      id: gameId,
      type: gameType,
      status: 'error',
      lastUpdated: new Date(),
      initialLoad: true,
      error: error.message
    };
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

// Exportar funções do serviço
module.exports = {
  registerClient,
  unregisterClient,
  broadcastToResource,
  getGameInitialData
}; 