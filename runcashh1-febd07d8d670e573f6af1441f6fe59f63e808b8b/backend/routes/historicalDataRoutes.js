const express = require('express');
const router = express.Router();
const historicalDataController = require('../controllers/historicalDataController');

// Rota para buscar o histórico inicial de todas as roletas
// GET /api/historical/all-roulettes
router.get('/all-roulettes', historicalDataController.getAllRoulettesInitialHistory);

module.exports = router; 