/**
 * Utilitários para Server-Sent Events (SSE)
 * Facilita o envio de eventos em tempo real para clientes conectados
 */

const crypto = require('crypto');

// Chave secreta para criptografia (em produção, usar variável de ambiente)
const SECRET_KEY = process.env.SSE_SECRET_KEY || 'runcash_sse_secret_key_2023';
const SECRET_IV = process.env.SSE_SECRET_IV || 'runcash_sse_iv';

/**
 * Criptografa dados no formato Fe26.2 (similar ao concorrente)
 * @param {Object} data - Dados a serem criptografados
 * @returns {String} - Dados criptografados
 */
function encryptData(data) {
  try {
    // Converter dados para string JSON
    const jsonData = JSON.stringify(data);
    
    // Criar hash da chave secreta para usar como chave de criptografia
    const key = crypto.createHash('sha256').update(SECRET_KEY).digest('base64').substr(0, 32);
    
    // Criar IV (vetor de inicialização)
    const iv = crypto.createHash('md5').update(SECRET_IV).digest('hex').substring(0, 16);
    
    // Criptografar dados
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
    let encrypted = cipher.update(jsonData, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Criar assinatura MAC para verificação de integridade
    const hmac = crypto.createHmac('sha256', key)
      .update(encrypted)
      .digest('base64');
    
    // Formato do token Fe26.2 (similar ao observado no concorrente)
    const timestamp = Date.now();
    const token = `Fe26.2*1*${crypto.randomBytes(16).toString('hex')}*${encrypted}*${iv}*${timestamp}*${hmac}~2`;
    
    return token;
  } catch (error) {
    console.error('Erro ao criptografar dados:', error);
    // Fallback para caso de erro na criptografia
    return JSON.stringify(data);
  }
}

/**
 * Envia um evento de atualização para todos os clientes SSE conectados
 * @param {Object} data - Dados a serem enviados
 * @param {String} eventType - Tipo de evento (default: 'update')
 * @param {Boolean} encrypt - Se deve criptografar os dados
 */
function broadcastSseEvent(data, eventType = 'update', encrypt = true) {
  // Verificar se existem clientes conectados
  if (!global.sseClients || global.sseClients.size === 0) {
    console.log('[SSE] Sem clientes conectados para enviar evento');
    return;
  }
  
  // Preparar dados (criptografados ou não)
  const eventData = encrypt ? encryptData(data) : JSON.stringify(data);
  
  // Contador de clientes que receberam o evento
  let receivedCount = 0;
  
  // Enviar para todos os clientes
  global.sseClients.forEach((client, id) => {
    try {
      client.send(eventType, eventData);
      receivedCount++;
    } catch (error) {
      console.error(`[SSE] Erro ao enviar para cliente ${id}:`, error);
      
      // Remover cliente com erro
      global.sseClients.delete(id);
    }
  });
  
  console.log(`[SSE] Evento '${eventType}' enviado para ${receivedCount}/${global.sseClients.size} clientes`);
}

/**
 * Limpa clientes SSE inativos
 * @param {Number} maxAge - Idade máxima em milissegundos (padrão: 1 hora)
 */
function cleanupSseClients(maxAge = 3600000) {
  if (!global.sseClients) return;
  
  const now = Date.now();
  let removedCount = 0;
  
  global.sseClients.forEach((client, id) => {
    if (now - client.timestamp > maxAge) {
      global.sseClients.delete(id);
      removedCount++;
    }
  });
  
  if (removedCount > 0) {
    console.log(`[SSE] Limpeza: ${removedCount} clientes inativos removidos`);
  }
}

// Executar limpeza a cada hora
setInterval(cleanupSseClients, 3600000);

/**
 * Envia atualizações de todas as roletas disponíveis
 * Útil para transmitir dados de múltiplas roletas simultaneamente
 * @param {Array} roulettesData - Array de objetos com dados das roletas
 */
function broadcastAllRoulettesUpdate(roulettesData) {
  // Verificar se há clientes conectados
  if (!global.sseClients || global.sseClients.size === 0) {
    console.log('[SSE] Sem clientes conectados para enviar atualização de roletas');
    return;
  }
  
  // Preparar dados combinados para todas as roletas
  const combinedData = {
    timestamp: new Date().toISOString(),
    roulettes: roulettesData || [],
    count: roulettesData ? roulettesData.length : 0
  };
  
  // Enviar usando a função de broadcast existente
  broadcastSseEvent(combinedData, 'update', true);
  
  console.log(`[SSE] Atualização de ${combinedData.count} roletas enviada para ${global.sseClients.size} clientes`);
}

module.exports = {
  encryptData,
  broadcastSseEvent,
  cleanupSseClients,
  broadcastAllRoulettesUpdate
}; 