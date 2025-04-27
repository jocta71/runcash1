/**
 * Arquivo de integração de rotas protegidas para roletas
 * para ser importado pelo servidor principal
 */

const express = require('express');
const router = express.Router();

// Importar as rotas de roletas
const roletasApi = require('../../routes/roletasApi');

// Montar as rotas no router
router.use('/', roletasApi);

module.exports = router; 