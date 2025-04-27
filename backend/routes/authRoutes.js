/**
 * Rotas para autenticação e gerenciamento de usuários
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const validationMiddleware = require('../middlewares/validationMiddleware');

// Registrar novo usuário
router.post(
  '/registrar',
  validationMiddleware.validarRegistro,
  validationMiddleware.sanitizarEntrada,
  authController.registrar
);

// Login de usuário
router.post(
  '/login',
  validationMiddleware.validarLogin,
  validationMiddleware.sanitizarEntrada,
  authMiddleware.limitarRequisicoes(10, 60 * 1000), // Limitar 10 tentativas por minuto
  authController.login
);

// Rota para verificar token e renovar
router.get(
  '/verificar-token',
  authMiddleware.proteger,
  authController.verificarToken
);

// Rota para solicitar redefinição de senha
router.post(
  '/esqueci-senha',
  validationMiddleware.validarEmail,
  validationMiddleware.sanitizarEntrada,
  authController.solicitarRedefinicaoSenha
);

// Rota para redefinir senha com token
router.post(
  '/redefinir-senha/:token',
  validationMiddleware.validarNovaSenha,
  validationMiddleware.sanitizarEntrada,
  authController.redefinirSenha
);

// Rota para atualizar perfil - protegida por autenticação
router.put(
  '/atualizar-perfil',
  authMiddleware.proteger,
  validationMiddleware.validarAtualizacaoPerfil,
  validationMiddleware.sanitizarEntrada,
  authController.atualizarPerfil
);

// Rota para alterar senha - protegida por autenticação
router.put(
  '/alterar-senha',
  authMiddleware.proteger,
  validationMiddleware.validarAlteracaoSenha,
  validationMiddleware.sanitizarEntrada,
  authController.alterarSenha
);

// Rota para logout
router.post('/logout', authController.logout);

// Rota para desativar conta - protegida por autenticação
router.delete(
  '/desativar-conta',
  authMiddleware.proteger,
  authController.desativarConta
);

// Rotas administrativas - protegidas por autenticação e restritas a administradores
router.use('/admin', authMiddleware.proteger, authMiddleware.restringirA('admin'));

// Listar todos os usuários - apenas para administradores
router.get('/admin/usuarios', authController.listarUsuarios);

// Obter detalhes de um usuário - apenas para administradores
router.get(
  '/admin/usuarios/:id',
  validationMiddleware.validarId('id'),
  authController.obterUsuario
);

// Atualizar usuário - apenas para administradores
router.put(
  '/admin/usuarios/:id',
  validationMiddleware.validarId('id'),
  validationMiddleware.validarAtualizacaoUsuario,
  validationMiddleware.sanitizarEntrada,
  authController.atualizarUsuario
);

// Deletar usuário - apenas para administradores
router.delete(
  '/admin/usuarios/:id',
  validationMiddleware.validarId('id'),
  authController.deletarUsuario
);

/**
 * @route   POST /api/auth/atualizar-token
 * @desc    Atualiza o token do usuário após aquisição de assinatura
 * @access  Privado
 */
router.post('/atualizar-token', authMiddleware.proteger, authController.atualizarTokenComAssinatura);

module.exports = router; 