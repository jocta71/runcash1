/**
 * Rotas para gerenciamento de assinaturas
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { authenticate } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middlewares/unifiedSubscriptionMiddleware');
const { checkSubscription } = require('../middleware/subscriptionCheck');
const { generateAccessKey } = require('../utils/cryptoUtils');

// Outras rotas existentes...
// ... existing code ...

/**
 * @route   GET /api/subscription/status
 * @desc    Verifica o status da assinatura do usuário
 * @access  Privado - Requer autenticação
 */
router.get('/status', checkSubscription, (req, res) => {
    // O middleware já verificou a assinatura
    res.json({
        success: true,
        subscription: req.subscription || req.assinatura
    });
});

/**
 * @route   GET /api/subscription/access-key
 * @desc    Obtém uma chave de acesso para descriptografia de dados da API
 * @access  Privado - Requer assinatura ativa
 */
router.get('/access-key', checkSubscription, async (req, res) => {
    try {
        // Verificar se o usuário tem uma assinatura ativa
        const subscription = req.subscription || req.assinatura;
        
        if (!subscription || subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Você precisa ter uma assinatura ativa para obter uma chave de acesso',
                code: 'SUBSCRIPTION_REQUIRED'
            });
        }
        
        // Gerar uma chave de acesso para o usuário
        const userId = req.user.id || req.user._id;
        const accessKey = await generateAccessKey(userId, subscription);
        
        // Responder com a chave de acesso
        return res.json({
            success: true,
            accessKey,
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 dias
            message: 'Chave de acesso gerada com sucesso. Esta chave expira em 7 dias.'
        });
    } catch (error) {
        console.error('Erro ao gerar chave de acesso:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao gerar chave de acesso',
            error: error.message
        });
    }
});

module.exports = router; 