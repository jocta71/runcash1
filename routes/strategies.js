/**
 * Rotas para gerenciamento de estratégias
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Rota para listar todas as estratégias (requer autenticação)
router.get('/', auth.authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Lista de estratégias recuperada com sucesso',
      data: [
        {
          id: '1',
          nome: 'Estratégia Básica',
          descricao: 'Estratégia para iniciantes'
        },
        {
          id: '2',
          nome: 'Estratégia Avançada',
          descricao: 'Estratégia para usuários avançados',
          premium: true
        }
      ]
    });
  } catch (error) {
    console.error('[Strategies] Erro ao listar estratégias:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estratégias',
      error: error.message
    });
  }
});

// Rota para obter estratégia específica (requer autenticação)
router.get('/:id', auth.authenticate, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Simular busca no banco de dados
    if (id === '1') {
      return res.json({
        success: true,
        data: {
          id: '1',
          nome: 'Estratégia Básica',
          descricao: 'Estratégia para iniciantes',
          regras: [
            'Aguarde 3 repetições',
            'Aposte no número oposto'
          ]
        }
      });
    } else if (id === '2') {
      // Verificar se o usuário é premium
      if (!req.usuario.premium) {
        return res.status(403).json({
          success: false,
          message: 'Esta estratégia requer assinatura premium',
          error: 'PREMIUM_REQUIRED'
        });
      }
      
      return res.json({
        success: true,
        data: {
          id: '2',
          nome: 'Estratégia Avançada',
          descricao: 'Estratégia para usuários avançados',
          premium: true,
          regras: [
            'Analise os últimos 50 números',
            'Identifique padrões de repetição',
            'Aposte nos números mais prováveis'
          ]
        }
      });
    }
    
    res.status(404).json({
      success: false,
      message: 'Estratégia não encontrada',
      error: 'NOT_FOUND'
    });
  } catch (error) {
    console.error('[Strategies] Erro ao buscar estratégia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estratégia',
      error: error.message
    });
  }
});

// Rota para criar nova estratégia (requer autenticação)
router.post('/', auth.authenticate, async (req, res) => {
  try {
    // Implementação completa exigiria salvar no banco de dados
    res.status(201).json({
      success: true,
      message: 'Estratégia criada com sucesso',
      data: {
        id: '3',
        ...req.body,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Strategies] Erro ao criar estratégia:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar estratégia',
      error: error.message
    });
  }
});

// Exportar router
module.exports = router; 