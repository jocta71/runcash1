const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const upload = require('../config/upload');
const path = require('path');
const fs = require('fs');

// @desc    Atualizar perfil do usuário
// @route   PUT /api/users/profile
// @access  Privado
router.put('/profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, username } = req.body;
    
    // Buscar o usuário atual
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Verificar se o username está sendo alterado e se já existe
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          error: 'Este nome de usuário já está em uso'
        });
      }
      user.username = username;
    }
    
    // Atualizar os campos de perfil
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    
    // Salvar as alterações
    await user.save();
    
    // Retornar o usuário atualizado sem a senha
    const updatedUser = await User.findById(req.user.id).select('-password');
    
    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar solicitação'
    });
  }
});

// @desc    Fazer upload de imagem de perfil
// @route   POST /api/users/profile/picture
// @access  Privado
router.post('/profile/picture', protect, upload.single('profilePicture'), async (req, res) => {
  try {
    // Verificar se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada'
      });
    }
    
    // Buscar o usuário atual
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Excluir a imagem anterior se existir e não for de terceiros (como Google)
    if (user.profilePicture && 
        !user.profilePicture.includes('googleusercontent.com') && 
        !user.profilePicture.startsWith('http')) {
      const oldImagePath = path.join(__dirname, '..', '..', '..', 'public', user.profilePicture);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Atualizar a URL da imagem de perfil
    const imageUrl = `/uploads/${req.file.filename}`;
    user.profilePicture = imageUrl;
    
    // Salvar as alterações
    await user.save();
    
    res.status(200).json({
      success: true,
      data: {
        profilePicture: imageUrl
      }
    });
  } catch (error) {
    console.error('Erro ao fazer upload de imagem:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar solicitação'
    });
  }
});

// @desc    Remover imagem de perfil
// @route   DELETE /api/users/profile/picture
// @access  Privado
router.delete('/profile/picture', protect, async (req, res) => {
  try {
    // Buscar o usuário atual
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Excluir a imagem anterior se existir e não for de terceiros
    if (user.profilePicture && 
        !user.profilePicture.includes('googleusercontent.com') && 
        !user.profilePicture.startsWith('http')) {
      const oldImagePath = path.join(__dirname, '..', '..', '..', 'public', user.profilePicture);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Limpar a URL da imagem de perfil
    user.profilePicture = '';
    
    // Salvar as alterações
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Imagem de perfil removida com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover imagem de perfil:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao processar solicitação'
    });
  }
});

module.exports = router; 