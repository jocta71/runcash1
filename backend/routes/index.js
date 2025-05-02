const express = require('express');
const router = express.Router();

// Importar rotas
const authRoutes = require('./authRoutes');
const rouletteRoutes = require('./rouletteRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');

// Configurar rotas
router.use('/auth', authRoutes);
router.use('/roulettes', rouletteRoutes);
router.use('/subscription', subscriptionRoutes);

// Rota de Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router; 