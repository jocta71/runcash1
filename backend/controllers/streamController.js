/**
 * Controlador para streams de eventos em tempo real (SSE)
 * Gerencia conexões persistentes com clientes para envio de dados atualizados
 */

const { registerClient, unregisterClient, getGameInitialData } = require('../services/streamService');
const { encryptData } = require('../utils/encryption');

/**
 * Estabelece uma conexão SSE para receber atualizações em tempo real de uma roleta
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const establishRouletteStream = async (req, res) => {
  try {
    const { gameType, gameId } = req.params;
    const version = req.params.version || 'v1'; // Suporte para versionamento de API
    const k = req.query.k || '0'; // Parâmetro de controle (similar ao concorrente)
    
    // Gerar ID único para esta conexão
    const connectionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Log detalhado para monitoramento
    console.log(`[STREAM ${connectionId}] Nova conexão SSE para ${gameType}/${gameId}`);
    console.log(`[STREAM ${connectionId}] Usuário: ${req.user?.id || 'anônimo'}`);
    console.log(`[STREAM ${connectionId}] IP: ${req.ip || req.headers['x-forwarded-for'] || 'desconhecido'}`);
    console.log(`[STREAM ${connectionId}] Parâmetros: version=${version}, k=${k}`);
    
    // Configurar cabeçalhos SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Importante para Nginx
    res.setHeader('pragma', 'no-cache'); // Para compatibilidade com navegadores mais antigos
    res.setHeader('expire', '0');
    
    // Enviar cabeçalho inicial para evitar timeout
    res.write(': ping\n\n');
    
    // Função para enviar eventos ao cliente
    const sendEvent = (data) => {
      return new Promise((resolve, reject) => {
        try {
          // Se a conexão já foi encerrada, não tenta enviar
          if (res.writableEnded) {
            return reject(new Error('Conexão fechada'));
          }
          
          // Formatação do evento SSE
          res.write(`event: update\n`);
          res.write(`id: ${Date.now()}\n`);
          res.write(`data: ${data}\n\n`);
          
          // Resolver imediatamente
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    };
    
    // Registrar cliente no serviço de stream
    const clientId = registerClient(gameType, gameId, sendEvent);
    
    // Enviar dados iniciais
    const initialData = await getGameInitialData(gameType, gameId);
    await sendEvent(encryptData(initialData));
    
    // Enviar keep-alive periodicamente para manter a conexão
    const keepAliveInterval = setInterval(() => {
      try {
        if (!res.writableEnded) {
          res.write(': ping\n\n');
        } else {
          clearInterval(keepAliveInterval);
        }
      } catch (error) {
        console.error(`[STREAM ${connectionId}] Erro no keep-alive:`, error);
        clearInterval(keepAliveInterval);
      }
    }, 30000); // 30 segundos
    
    // Lidar com fechamento da conexão
    req.on('close', () => {
      clearInterval(keepAliveInterval);
      unregisterClient(clientId);
      console.log(`[STREAM ${connectionId}] Conexão fechada para ${gameType}/${gameId}`);
    });
  } catch (error) {
    console.error('[STREAM] Erro ao estabelecer stream:', error);
    
    // Se ainda é possível enviar resposta
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erro ao estabelecer conexão de streaming',
        error: error.message
      });
    } else {
      try {
        // Tentar enviar erro como evento SSE
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      } catch (err) {
        console.error('[STREAM] Erro secundário ao enviar mensagem de erro:', err);
      }
    }
  }
};

/**
 * Verifica o status de disponibilidade do serviço de streaming
 * @param {Object} req - Requisição Express
 * @param {Object} res - Resposta Express
 */
const checkStreamStatus = (req, res) => {
  res.json({
    success: true,
    status: 'online',
    service: 'RunCash SSE Streaming',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  establishRouletteStream,
  checkStreamStatus
}; 