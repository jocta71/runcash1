/**
 * Rotas para streaming de dados usando SSE (Server-Sent Events)
 */

const express = require('express');
const router = express.Router();
const rouletteStreamService = require('../services/rouletteStreamService');
const rouletteDataService = require('../services/rouletteDataService');
const { proteger: protect, restringirA: admin } = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/stream/roulettes
 * @desc    Stream de atualizações de roletas (SSE) ou requisição JSON regular com parâmetro nostream=true
 * @access  Public (dados criptografados para usuários sem assinatura)
 */
router.get('/roulettes', async (req, res) => {
  // Verificar se a requisição é para streaming ou para dados regulares
  const noStream = req.query.nostream === 'true';
  
  // Se o parâmetro nostream=true for fornecido, tratar como uma requisição JSON regular
  if (noStream) {
    console.log('[API] Requisição regular (não-streaming) para /api/stream/roulettes');
    
    try {
      // Obter os dados mais recentes das roletas
      const roulettes = await rouletteDataService.getRoulettes();
      
      // Obter informações do usuário para decidir sobre criptografia
      let user = req.user || { role: 'public' };
      const needsEncryption = !(user && user.role === 'admin') && 
                             !(user && user.subscription && user.subscription.status === 'active');
      
      // Se o usuário precisar de criptografia, criptografar os dados
      if (needsEncryption) {
        console.log('[Encryption] Criptografando dados para: public-access');
        try {
          const encryptedData = await rouletteStreamService.encryptData(roulettes);
          return res.json({
            encrypted: true,
            format: 'iron',
            encryptedData,
            message: 'Dados criptografados. Use sua chave de acesso para descriptografar.'
          });
        } catch (encryptError) {
          console.error('[Encryption] Erro ao criptografar dados:', encryptError);
          return res.status(500).json({ error: 'Erro ao processar dados' });
        }
      }
      
      // Retornar os dados em formato JSON para requisições não-streaming
      return res.json(roulettes);
    } catch (error) {
      console.error('[API] Erro ao buscar dados para requisição não-streaming:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados' });
    }
  }
  
  // Configuração para streaming SSE
  // Obter informações do usuário
  let user = req.user || { role: 'public' };
  
  console.log(`[Stream] Nova conexão de ${user.role || 'usuário anônimo'}`);
  console.log(`[Stream] IP: ${req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
  
  try {
    // Configurar cliente para o serviço de streaming
    rouletteStreamService.addClient({
      res,
      user,
      needsEncryption: !(user && user.role === 'admin') && 
                      !(user && user.subscription && user.subscription.status === 'active')
    });
    
    // Nota: O serviço de streaming gerenciará o ciclo de vida da resposta
  } catch (error) {
    console.error('[Stream] Erro ao configurar stream SSE:', error);
    res.status(500).json({ error: 'Erro ao configurar stream' });
  }
});

/**
 * @route   GET /api/stream/stats
 * @desc    Retorna estatísticas do serviço de streaming
 * @access  Private
 */
router.get('/stats', protect, (req, res) => {
  try {
    const streamStats = {
      connections: rouletteStreamService.getClientCount(),
      lastBroadcastTime: rouletteStreamService.getLastBroadcastTime(),
      eventId: rouletteStreamService.eventId,
    };
    
    const dataStats = rouletteDataService.getStats();
    
    res.json({
      stream: streamStats,
      data: dataStats,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Stream] Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

/**
 * @route   GET /api/stream/diagnostic
 * @desc    Endpoint de diagnóstico para verificar o status do serviço de streaming
 * @access  Public
 */
router.get('/diagnostic', (req, res) => {
  try {
    const status = {
      streamServiceActive: true,
      clientCount: rouletteStreamService.getClientCount(),
      lastBroadcastTime: rouletteStreamService.getLastBroadcastTime() || null,
      dataServiceActive: rouletteDataService.isRunning || false,
      lastFetchTime: rouletteDataService.lastFetchTime || null
    };
    
    // Adicionar delay entre último broadcast e agora
    if (status.lastBroadcastTime) {
      status.timeSinceLastBroadcast = Date.now() - status.lastBroadcastTime;
      status.broadcastStatus = status.timeSinceLastBroadcast < 30000 ? 'ok' : 'delayed';
    } else {
      status.broadcastStatus = 'never';
    }
    
    // Adicionar informações de conexão
    status.yourIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    status.timestamp = Date.now();
    
    res.json(status);
  } catch (error) {
    console.error('[Stream] Erro em diagnóstico:', error);
    res.status(500).json({ 
      error: 'Erro ao realizar diagnóstico',
      errorDetails: error.message
    });
  }
});

/**
 * @route   POST /api/stream/simulate-event
 * @desc    Simula um evento para testar o streaming
 * @access  Private (somente admin)
 */
router.post('/simulate-event', protect, (req, res) => {
  try {
    const { type = 'test', data = {} } = req.body;
    
    // Criar evento de teste
    const testEvent = {
      type,
      timestamp: Date.now(),
      data: {
        ...data,
        message: data.message || 'Evento de teste',
        simulatedBy: req.user?.email || 'sistema'
      }
    };
    
    // Enviar para todos os clientes conectados
    rouletteStreamService.broadcastUpdate(testEvent);
    
    res.json({
      success: true,
      message: 'Evento simulado enviado com sucesso',
      clients: rouletteStreamService.getClientCount(),
      event: testEvent
    });
  } catch (error) {
    console.error('[Stream] Erro ao simular evento:', error);
    res.status(500).json({ error: 'Erro ao simular evento' });
  }
});

/**
 * @route   POST /api/stream/test
 * @desc    Envia um evento de teste para verificar o funcionamento
 * @access  Public
 */
router.post('/test', (req, res) => {
  try {
    const success = rouletteStreamService.sendTestEvent();
    
    res.json({
      success: true,
      message: 'Evento de teste enviado',
      clientCount: rouletteStreamService.getClientCount()
    });
  } catch (error) {
    console.error('[Stream] Erro ao enviar evento de teste:', error);
    res.status(500).json({ error: 'Erro ao enviar evento de teste' });
  }
});

module.exports = router; 