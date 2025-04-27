/**
 * Controlador de autenticação e gerenciamento de usuários
 */

const { Usuario } = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const authMiddleware = require('../middlewares/authMiddleware');
const enviarEmail = require('../services/emailService');

/**
 * Atualiza o token do usuário após a aquisição de uma assinatura
 * @route   POST /api/auth/atualizarToken
 * @access  Privado
 */
exports.atualizarTokenComAssinatura = async (req, res) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        error: 'ERROR_NOT_AUTHENTICATED'
      });
    }
    
    const { assinaturaId, plano } = req.body;
    
    if (!assinaturaId) {
      return res.status(400).json({
        success: false,
        message: 'ID da assinatura é obrigatório',
        error: 'ERROR_MISSING_SUBSCRIPTION_ID'
      });
    }
    
    // Criar objeto de assinatura para gerar o token
    const assinatura = {
      id: assinaturaId,
      plano: plano || 'PREMIUM'
    };
    
    // Gerar novo token com informações da assinatura
    const token = authMiddleware.gerarTokenComAssinatura(req.usuario, assinatura);
    
    return res.status(200).json({
      success: true,
      message: 'Token atualizado com sucesso',
      token
    });
  } catch (error) {
    console.error('Erro ao atualizar token:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar token',
      error: error.message
    });
  }
}; 