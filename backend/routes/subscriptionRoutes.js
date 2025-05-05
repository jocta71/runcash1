/**
 * Rotas para gerenciamento de assinaturas
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect } = require('../middleware/authMiddleware');
const iron = require('@hapi/iron');
const crypto = require('crypto');
const User = require('../models/userModel');
const SubscriptionKey = require('../models/subscriptionKeyModel');

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
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('subscription');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    
    res.json({
      success: true,
      subscription: user.subscription || null
    });
  } catch (error) {
    console.error('Erro ao buscar status da assinatura:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar o status da assinatura' 
    });
  }
});

/**
 * @route   GET /api/subscription/access-key
 * @desc    Obtém uma chave de acesso para descriptografia de dados da API
 * @access  Privado - Requer apenas autenticação (sem restrição de assinatura)
 */
router.get('/access-key', protect, async (req, res) => {
  try {
    // Removendo verificação de assinatura ativa
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuário não encontrado' 
      });
    }
    
    // Buscar a chave de acesso atual do usuário ou criar uma nova
    let subscriptionKey = await SubscriptionKey.findOne({ userId: req.user._id });
    
    if (!subscriptionKey) {
      // Criar uma nova chave de acesso
      const newKey = crypto.randomBytes(32).toString('hex');
      
      subscriptionKey = await SubscriptionKey.create({
        userId: req.user._id,
        key: newKey,
        createdAt: new Date()
      });
    }
    
    res.json({
      id: subscriptionKey._id,
      key: subscriptionKey.key,
      createdAt: subscriptionKey.createdAt,
      lastUsed: subscriptionKey.lastUsed
    });
  } catch (error) {
    console.error('Erro ao buscar chave de acesso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar a chave de acesso' 
    });
  }
});

/**
 * @route   DELETE /api/subscription/access-key
 * @desc    Revoga uma chave de acesso
 * @access  Privado - Requer autenticação
 */
router.delete('/access-key', authenticate, subscriptionController.revokeAccessKey);

// @desc    Regenerate API access key
// @route   POST /api/subscription/regenerate-key
// @access  Private
router.post('/regenerate-key', protect, async (req, res) => {
  try {
    // Removendo verificação de assinatura ativa
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuário não encontrado' 
      });
    }
    
    // Gerar nova chave de acesso
    const newKey = crypto.randomBytes(32).toString('hex');
    
    // Atualizar ou criar registro de chave
    let subscriptionKey = await SubscriptionKey.findOne({ userId: req.user._id });
    
    if (subscriptionKey) {
      subscriptionKey.key = newKey;
      subscriptionKey.createdAt = new Date();
      subscriptionKey.lastUsed = null;
      await subscriptionKey.save();
    } else {
      subscriptionKey = await SubscriptionKey.create({
        userId: req.user._id,
        key: newKey,
        createdAt: new Date()
      });
    }
    
    res.json({
      id: subscriptionKey._id,
      key: subscriptionKey.key,
      createdAt: subscriptionKey.createdAt,
      lastUsed: subscriptionKey.lastUsed
    });
  } catch (error) {
    console.error('Erro ao regenerar chave de acesso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao regenerar a chave de acesso' 
    });
  }
});

// @desc    Validate API access key
// @route   POST /api/subscription/validate-key
// @access  Public
router.post('/validate-key', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ 
        success: false, 
        message: 'Chave de acesso não fornecida' 
      });
    }
    
    // Buscar a chave no banco de dados
    const subscriptionKey = await SubscriptionKey.findOne({ key });
    
    if (!subscriptionKey) {
      return res.status(401).json({ 
        success: false, 
        message: 'Chave de acesso inválida' 
      });
    }
    
    // Removendo verificação de assinatura ativa para validação da chave
    const user = await User.findById(subscriptionKey.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuário associado à chave não encontrado' 
      });
    }
    
    // Atualizar o último uso da chave
    subscriptionKey.lastUsed = new Date();
    await subscriptionKey.save();
    
    res.json({
      success: true,
      message: 'Chave de acesso válida',
      userId: user._id
    });
  } catch (error) {
    console.error('Erro ao validar chave de acesso:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao validar a chave de acesso' 
    });
  }
});

module.exports = router; 