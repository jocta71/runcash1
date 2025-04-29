const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const User = require('../models/user.model');
const jwtUtils = require('../utils/jwt.utils');

/**
 * @route   POST /api/users/register
 * @desc    Registra um novo usuário
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, externalId } = req.body;
    
    // Verificar se o email já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }
    
    // Criar novo usuário
    const user = new User({
      name,
      email,
      password,
      externalId
    });
    
    await user.save();
    
    // Gerar token JWT
    const token = jwtUtils.generateToken(user);
    
    // Retornar dados do usuário (sem a senha)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      externalId: user.externalId
    };
    
    return res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      user: userData,
      token
    });
  } catch (error) {
    console.error('[User] Erro ao registrar usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao registrar usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/users/login
 * @desc    Autentica um usuário
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuário pelo email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Verificar senha
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }
    
    // Gerar token JWT
    const token = jwtUtils.generateToken(user);
    
    // Retornar dados do usuário (sem a senha)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      user: userData,
      token
    });
  } catch (error) {
    console.error('[User] Erro ao fazer login:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao fazer login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/users/me
 * @desc    Retorna os dados do usuário autenticado
 * @access  Private
 */
router.get('/me', authMiddleware.authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Retornar dados do usuário (sem a senha)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      asaasCustomerId: user.asaasCustomerId,
      externalId: user.externalId
    };
    
    return res.status(200).json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('[User] Erro ao obter dados do usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados do usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   PUT /api/users/update
 * @desc    Atualiza os dados do usuário autenticado
 * @access  Private
 */
router.put('/update', authMiddleware.authenticate, async (req, res) => {
  try {
    const { name, phone, cpfCnpj, postalCode, address, addressNumber, complement, province } = req.body;
    const userId = req.user._id;
    
    // Não permitir atualização de email ou senha por esta rota
    const updatedData = {
      name,
      phone,
      cpfCnpj,
      postalCode,
      address,
      addressNumber,
      complement,
      province
    };
    
    // Remover campos undefined
    Object.keys(updatedData).forEach(key => {
      if (updatedData[key] === undefined) {
        delete updatedData[key];
      }
    });
    
    // Atualizar usuário
    const user = await User.findByIdAndUpdate(
      userId,
      updatedData,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Retornar dados atualizados do usuário (sem a senha)
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpfCnpj: user.cpfCnpj,
      postalCode: user.postalCode,
      address: user.address,
      addressNumber: user.addressNumber,
      complement: user.complement,
      province: user.province
    };
    
    return res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: userData
    });
  } catch (error) {
    console.error('[User] Erro ao atualizar usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 