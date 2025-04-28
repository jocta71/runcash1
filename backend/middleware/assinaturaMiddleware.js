const ErrorResponse = require('../utils/errorResponse');
const Assinatura = require('../models/Assinatura');
const Usuario = require('../models/Usuario');

/**
 * Middleware para verificar se o usuário possui uma assinatura ativa
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.verificarAssinatura = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.usuario || !req.usuario.id) {
      return next(new ErrorResponse('Usuário não autenticado', 401));
    }

    // Buscar a assinatura ativa do usuário
    const assinatura = await Assinatura.findOne({
      usuario: req.usuario.id,
      status: 'ativa',
      validade: { $gt: new Date() }
    });

    // Se não existir assinatura ativa, retornar erro
    if (!assinatura) {
      return next(
        new ErrorResponse('Você precisa de uma assinatura ativa para acessar este recurso', 403)
      );
    }

    // Adicionar informações da assinatura ao objeto de requisição
    req.assinatura = assinatura;
    next();
  } catch (error) {
    next(new ErrorResponse('Erro ao verificar assinatura', 500));
  }
};

/**
 * Middleware para verificar se o usuário possui um plano específico
 * @param {Array} planosPermitidos - Array com os planos permitidos
 */
exports.verificarPlano = (planosPermitidos) => {
  return async (req, res, next) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.usuario || !req.usuario.id) {
        return next(new ErrorResponse('Usuário não autenticado', 401));
      }

      // Buscar a assinatura ativa do usuário
      const assinatura = await Assinatura.findOne({
        usuario: req.usuario.id,
        status: 'ativa',
        validade: { $gt: new Date() }
      });

      // Se não existir assinatura ativa, retornar erro
      if (!assinatura) {
        return next(
          new ErrorResponse('Você precisa de uma assinatura ativa para acessar este recurso', 403)
        );
      }

      // Verificar se o plano do usuário está entre os permitidos
      if (!planosPermitidos.includes(assinatura.plano)) {
        return next(
          new ErrorResponse(`É necessário um plano superior para acessar este recurso. Planos permitidos: ${planosPermitidos.join(', ')}`, 403)
        );
      }

      // Adicionar informações da assinatura ao objeto de requisição
      req.assinatura = assinatura;
      next();
    } catch (error) {
      next(new ErrorResponse('Erro ao verificar plano de assinatura', 500));
    }
  };
};

/**
 * Middleware para adicionar informações da assinatura sem bloquear o acesso
 * Útil para rotas que não exigem assinatura, mas precisam saber se o usuário tem uma
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
exports.adicionarInfoAssinatura = async (req, res, next) => {
  try {
    // Se o usuário estiver autenticado, buscar informações da assinatura
    if (req.usuario && req.usuario.id) {
      const assinatura = await Assinatura.findOne({
        usuario: req.usuario.id,
        status: 'ativa',
        validade: { $gt: new Date() }
      });

      // Adicionar assinatura à requisição (pode ser null se não existir)
      req.assinatura = assinatura;
    }
    
    // Seguir para o próximo middleware sem bloquear o acesso
    next();
  } catch (error) {
    // Em caso de erro, apenas logar e prosseguir sem bloquear
    console.error('Erro ao adicionar informações de assinatura:', error);
    next();
  }
}; 