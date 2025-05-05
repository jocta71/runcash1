/**
 * Utilitário para gerenciar o stream de eventos SSE (Server-Sent Events)
 * para resultados da roleta
 */

// Armazena as conexões ativas por sala/mesa de roleta
const connections = new Map();

/**
 * Configura o response para Server-Sent Events
 * @param {Object} res - Objeto Response do Express
 */
const setupSSEHeaders = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Para Nginx
  res.flushHeaders();
};

/**
 * Adiciona uma nova conexão ao gerenciador de streams
 * @param {string} tableId - ID da mesa/sala da roleta
 * @param {Object} res - Objeto response do Express para esta conexão
 * @returns {Function} - Função para remover a conexão quando fechada
 */
const addConnection = (tableId, res) => {
  if (!connections.has(tableId)) {
    connections.set(tableId, new Set());
  }
  
  const tableConnections = connections.get(tableId);
  tableConnections.add(res);
  
  // Retorna função para remover a conexão
  return () => {
    const table = connections.get(tableId);
    if (table) {
      table.delete(res);
      
      // Se não houver mais conexões para esta mesa, remova a entrada
      if (table.size === 0) {
        connections.delete(tableId);
      }
    }
  };
};

/**
 * Envia um evento para todas as conexões de uma mesa específica
 * @param {string} tableId - ID da mesa/sala da roleta
 * @param {string} eventType - Tipo do evento (geralmente "update")
 * @param {string} data - Dados criptografados a serem enviados
 * @param {number} eventId - ID sequencial do evento
 */
const broadcastToTable = (tableId, eventType, data, eventId) => {
  const tableConnections = connections.get(tableId);
  
  if (!tableConnections || tableConnections.size === 0) {
    return; // Sem conexões para esta mesa
  }
  
  // Formato do evento SSE
  const event = `event: ${eventType}\nid: ${eventId}\ndata: ${data}\n\n`;
  
  // Envia para todas as conexões
  for (const res of tableConnections) {
    try {
      res.write(event);
    } catch (error) {
      console.error(`Erro ao enviar evento para conexão: ${error.message}`);
      // Em caso de erro, remova a conexão
      tableConnections.delete(res);
    }
  }
};

/**
 * Envia um heartbeat para manter as conexões ativas
 * @param {Object} res - Conexão para enviar o heartbeat
 */
const sendHeartbeat = (res) => {
  try {
    res.write(': heartbeat\n\n');
  } catch (error) {
    console.error(`Erro ao enviar heartbeat: ${error.message}`);
  }
};

/**
 * Configura heartbeats regulares para todas as conexões ativas
 * @param {number} intervalMs - Intervalo em milissegundos (padrão: 30s)
 */
const setupHeartbeats = (intervalMs = 30000) => {
  setInterval(() => {
    for (const [tableId, tableConnections] of connections.entries()) {
      for (const res of tableConnections) {
        sendHeartbeat(res);
      }
    }
  }, intervalMs);
};

module.exports = {
  setupSSEHeaders,
  addConnection,
  broadcastToTable,
  sendHeartbeat,
  setupHeartbeats
}; 