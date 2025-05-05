/**
 * Rotas para streaming de dados usando SSE (Server-Sent Events)
 */

const express = require('express');
const router = express.Router();
const rouletteStreamService = require('../services/rouletteStreamService');
const { verifyAccessKey } = require('../middlewares/encryptionMiddleware');

/**
 * @route   GET /api/stream/roulettes
 * @desc    Conecta a um stream SSE para receber atualizações de roletas em tempo real
 * @access  Público (criptografia aplicada conforme permissões)
 */
router.get('/roulettes', verifyAccessKey, (req, res) => {
  try {
    // Configurar cliente para o serviço de streaming
    const client = {
      res,
      user: req.user || null,
      // Se não houver usuário autenticado ou não tiver chave de acesso, criptografar os dados
      needsEncryption: !req.user || !req.user.hasValidAccessKey
    };
    
    // Registrar cliente no serviço de streaming
    rouletteStreamService.addClient(client);
    
    // Nota: não fechar a resposta - a conexão é mantida aberta para SSE
  } catch (error) {
    console.error('Erro ao iniciar stream de roletas:', error);
    res.status(500).json({ error: 'Erro ao iniciar stream' });
  }
});

/**
 * @route   POST /api/stream/simulate-event
 * @desc    Simula um evento de atualização de roleta (apenas para testes)
 * @access  Privado - Admin
 */
router.post('/simulate-event', (req, res) => {
  // Verificar se o usuário é admin (em uma implementação real)
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  try {
    const eventData = req.body;
    
    // Broadcast do evento para todos os clientes conectados
    rouletteStreamService.broadcastUpdate(eventData);
    
    res.json({
      success: true, 
      message: 'Evento enviado',
      clientCount: rouletteStreamService.getClientCount()
    });
  } catch (error) {
    console.error('Erro ao simular evento:', error);
    res.status(500).json({ error: 'Erro ao simular evento' });
  }
});

/**
 * @route   GET /api/stream/stats
 * @desc    Retorna estatísticas do serviço de streaming
 * @access  Privado - Admin
 */
router.get('/stats', (req, res) => {
  // Verificar se o usuário é admin (em uma implementação real)
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  res.json({
    connectedClients: rouletteStreamService.getClientCount(),
    eventId: rouletteStreamService.eventId
  });
});

module.exports = router; 