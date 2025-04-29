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

module.exports = router; 