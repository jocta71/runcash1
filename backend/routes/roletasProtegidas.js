/**
 * Arquivo de integração de rotas protegidas para roletas
 * para ser importado pelo servidor principal
 */

import express from 'express';
import roletasApi from '../../routes/roletasApi.js';

const router = express.Router();

// Montar as rotas no router
router.use('/', roletasApi);

export default router; 