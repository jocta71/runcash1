/**
 * Controller para gerenciar Server-Sent Events (SSE)
 * Implementa streaming de dados em tempo real para clientes
 */

const cryptoService = require('../services/cryptoService');

// Armazenar clientes conectados
const connectedClients = new Set();

// Armazenar últimos dados enviados para novos clientes
let lastRoulettesData = null;
let lastUpdateTimestamp = Date.now();

/**
 * Estabelece uma conexão SSE com o cliente
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 */
exports.establishConnection = (req, res) => {
  // Configurar cabeçalhos para SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Gerar ID único para este cliente
  const clientId = Date.now();
  
  // Enviar mensagem inicial
  const initialMessage = {
    type: 'connection',
    message: 'Conexão SSE estabelecida',
    clientId,
    timestamp: new Date().toISOString()
  };
  
  sendEvent(res, 'connect', initialMessage);
  
  // Se houver dados recentes disponíveis, enviar imediatamente
  if (lastRoulettesData) {
    sendCryptedData(res, lastRoulettesData);
  }
  
  // Adicionar cliente à lista de conectados
  connectedClients.add(res);
  console.log(`[SSE] Cliente conectado. Total: ${connectedClients.size}`);
  
  // Ping a cada 30 segundos para manter conexão ativa
  const pingInterval = setInterval(() => {
    sendEvent(res, 'ping', { timestamp: Date.now() });
  }, 30000);
  
  // Quando cliente desconectar
  req.on('close', () => {
    // Remover cliente e limpar intervalo
    connectedClients.delete(res);
    clearInterval(pingInterval);
    console.log(`[SSE] Cliente desconectado. Restantes: ${connectedClients.size}`);
  });
};

/**
 * Envia dados criptografados para todos os clientes conectados
 * @param {Object} data - Dados a serem enviados
 */
exports.broadcastData = async (data) => {
  // Armazenar dados mais recentes
  lastRoulettesData = data;
  lastUpdateTimestamp = Date.now();
  
  // Enviar para todos os clientes conectados
  const clientsArray = Array.from(connectedClients);
  
  console.log(`[SSE] Enviando atualização para ${clientsArray.length} clientes`);
  
  for (const client of clientsArray) {
    try {
      await sendCryptedData(client, data);
    } catch (error) {
      console.error('[SSE] Erro ao enviar para cliente:', error);
      // Remover cliente com erro
      connectedClients.delete(client);
    }
  }
};

/**
 * Envia um evento para o cliente
 * @param {Object} res - Objeto de resposta do cliente
 * @param {String} eventName - Nome do evento
 * @param {Object} data - Dados do evento
 */
function sendEvent(res, eventName, data) {
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`id: ${Date.now()}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    console.error('[SSE] Erro ao enviar evento:', error);
  }
}

/**
 * Envia dados criptografados para um cliente
 * @param {Object} res - Objeto de resposta do cliente
 * @param {Object} data - Dados a serem criptografados e enviados
 */
async function sendCryptedData(res, data) {
  try {
    // Criptografar dados
    const encryptedData = await cryptoService.encrypt(data);
    
    // Enviar como evento de atualização
    sendEvent(res, 'update', encryptedData);
  } catch (error) {
    console.error('[SSE] Erro ao criptografar dados:', error);
    throw error;
  }
} 