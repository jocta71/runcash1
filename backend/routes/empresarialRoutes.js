/**
 * Rotas para funcionalidades exclusivas do plano empresarial
 */

const express = require('express');
const router = express.Router();
const { proteger } = require('../middlewares/authMiddleware');
const { verificarPlano } = require('../middleware/assinaturaMiddleware');

// Controlador temporário com funções básicas
const empresarialController = {
  obterRelatorioDepartamental: (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Relatório departamental gerado com sucesso',
      data: {
        relatorio: {
          tipo: 'departamental',
          departamentos: 5,
          usuarios: 25,
          transacoes: 1250,
          periodo: 'último mês'
        },
        assinatura: req.assinatura
      }
    });
  },
  
  obterDadosEquipe: (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Dados da equipe obtidos com sucesso',
      data: {
        equipe: {
          membros: 12,
          departamentos: 3,
          relatoriosGerados: 45,
          objetivosMensais: 8,
          objetivosConcluidos: 6
        },
        assinatura: req.assinatura
      }
    });
  },
  
  criarUsuarioCorporativo: (req, res) => {
    res.status(201).json({
      success: true,
      message: 'Usuário corporativo criado com sucesso',
      data: {
        usuario: {
          id: 'novo-usuario-id',
          nome: req.body.nome || 'Novo Usuário',
          email: req.body.email || 'novo@empresa.com',
          departamento: req.body.departamento || 'Financeiro',
          permissoes: req.body.permissoes || ['visualizar', 'editar']
        },
        assinatura: req.assinatura
      }
    });
  }
};

// Aplicar middleware de autenticação em todas as rotas
router.use(proteger);

// Aplicar middleware para verificar plano empresarial
router.use(verificarPlano(['empresarial']));

// Rotas de relatórios departamentais
router.get('/relatorios/departamental', empresarialController.obterRelatorioDepartamental);

// Rotas de gerenciamento de equipe
router.get('/equipe', empresarialController.obterDadosEquipe);

// Rotas de usuários corporativos
router.post('/usuarios', empresarialController.criarUsuarioCorporativo);

module.exports = router; 