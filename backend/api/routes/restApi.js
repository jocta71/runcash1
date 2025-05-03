const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { validateCreateItem, validateUpdateItem, validateIdParam } = require('../middleware/validateItem');

// Importar handlers de pagamento
const asaasWebhookHandler = require('../payment/asaas-webhook');

/**
 * @route   GET /api/rest/items
 * @desc    Get all items
 * @access  Public
 */
router.get('/items', itemController.getAllItems);

/**
 * @route   GET /api/rest/items/:id
 * @desc    Get item by ID
 * @access  Public
 */
router.get('/items/:id', validateIdParam, itemController.getItemById);

/**
 * @route   POST /api/rest/items
 * @desc    Create a new item
 * @access  Public
 */
router.post('/items', validateCreateItem, itemController.createItem);

/**
 * @route   PUT /api/rest/items/:id
 * @desc    Update an item
 * @access  Public
 */
router.put('/items/:id', validateIdParam, validateUpdateItem, itemController.updateItem);

/**
 * @route   DELETE /api/rest/items/:id
 * @desc    Delete an item
 * @access  Public
 */
router.delete('/items/:id', validateIdParam, itemController.deleteItem);

/**
 * Webhook para receber eventos do Asaas
 * @route POST /api/webhook/asaas
 * @access Público
 */
router.post('/webhook/asaas', asaasWebhookHandler);

/**
 * Rota para teste do Webhook Asaas
 * @route GET /api/webhook/asaas/test
 * @access Público
 */
router.get('/webhook/asaas/test', (req, res) => {
  console.log('[WEBHOOK TEST] Teste de webhook acessado em:', new Date().toISOString());
  console.log('[WEBHOOK TEST] Headers:', JSON.stringify(req.headers, null, 2));
  
  // Responder com informações úteis para debug
  res.status(200).json({
    message: 'Endpoint de webhook do Asaas está ativo e funcionando',
    timestamp: new Date().toISOString(),
    route: 'GET /api/webhook/asaas/test',
    info: 'Use POST /api/webhook/asaas para enviar eventos do Asaas'
  });
});

/**
 * Rota para listar logs de Webhook Asaas
 * @route GET /api/webhook/asaas/logs
 * @access Público
 */
router.get('/webhook/asaas/logs', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Banco de dados não disponível' });
    }
    
    // Verificar coleções relacionadas a webhooks
    const collections = [
      'webhook_logs',
      'asaas_events',
      'processedWebhooks'
    ];
    
    const result = {};
    
    for (const collection of collections) {
      try {
        const logs = await db.collection(collection)
          .find({})
          .sort({ _id: -1 })
          .limit(10)
          .toArray();
        
        result[collection] = {
          count: logs.length,
          data: logs
        };
      } catch (err) {
        result[collection] = {
          error: err.message,
          exists: false
        };
      }
    }
    
    // Verificar também as assinaturas
    const subscriptions = await db.collection('subscriptions')
      .find({})
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();
    
    result.subscriptions = {
      count: subscriptions.length,
      data: subscriptions
    };
    
    res.status(200).json(result);
  } catch (error) {
    console.error('[WEBHOOK LOGS] Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro ao buscar logs de webhook', message: error.message });
  }
});

module.exports = router; 