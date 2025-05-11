/**
 * Rotas protegidas que requerem autenticação
 * Algumas rotas também requerem assinatura premium
 */

const express = require('express');
const router = express.Router();

// Importar middlewares
const { proteger, verificarPremium, restringirA } = require('../middlewares/authMiddleware');
const { validate, validateId } = require('../middlewares/validationMiddleware');

// Controladores (simulados - na implementação real você importaria os controladores reais)
const protectedController = {
  getDadosUsuario: (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        usuario: req.usuario
      }
    });
  },
  
  getRecursosPremium: (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Você tem acesso aos recursos premium',
      data: {
        recursosPremium: [
          { id: 1, nome: 'Recurso Premium 1', descricao: 'Descrição do recurso premium 1' },
          { id: 2, nome: 'Recurso Premium 2', descricao: 'Descrição do recurso premium 2' },
          { id: 3, nome: 'Recurso Premium 3', descricao: 'Descrição do recurso premium 3' }
        ]
      }
    });
  },
  
  getRecursosAdmin: (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Você tem acesso aos recursos de administrador',
      data: {
        recursosAdmin: [
          { id: 1, nome: 'Estatísticas de Usuários', url: '/admin/estatisticas/usuarios' },
          { id: 2, nome: 'Gerenciar Assinaturas', url: '/admin/assinaturas' },
          { id: 3, nome: 'Logs do Sistema', url: '/admin/logs' }
        ]
      }
    });
  },
  
  getRecursoPorId: (req, res) => {
    const id = req.params.id;
    
    res.status(200).json({
      success: true,
      data: {
        recurso: {
          id: parseInt(id),
          nome: `Recurso ${id}`,
          descricao: `Este é o recurso com ID ${id}`,
          dataCriacao: new Date().toISOString()
        }
      }
    });
  }
};

// Rota básica protegida - requer apenas autenticação
router.get('/perfil', proteger, protectedController.getDadosUsuario);

// Rota que requer assinatura premium
router.get('/premium', 
  proteger, 
  verificarPremium, 
  protectedController.getRecursosPremium
);

// Rota que requer papel de administrador
router.get('/admin', 
  proteger, 
  restringirA('admin'), 
  protectedController.getRecursosAdmin
);

// Rota com validação de parâmetros
router.get('/recursos/:id', 
  validateId,
  proteger, 
  protectedController.getRecursoPorId
);

module.exports = router; 