/**
 * Middleware que combina autenticação JWT e verificação
 * de assinatura ativa no Asaas
 */

import jwt from 'jsonwebtoken';
import axios from 'axios';

// Configurações do JWT
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

// Configurações do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

/**
 * Middleware para verificar autenticação JWT e assinatura ativa no Asaas
 * @param {Object} req - Objeto de requisição Express
 * @param {Object} res - Objeto de resposta Express
 * @param {Function} next - Função next do Express
 */
export const verificarAutenticacaoEAssinatura = async (req, res, next) => {
  try {
    // 1. Verificar se o token está presente
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado - token não fornecido',
        error: 'ERROR_NO_TOKEN'
      });
    }
    
    // 2. Verificar e decodificar o token JWT
    let decodificado;
    try {
      decodificado = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado, faça login novamente',
          error: 'ERROR_TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'ERROR_INVALID_TOKEN'
      });
    }
    
    // 3. Adicionar informações do usuário ao objeto da requisição
    req.usuario = {
      id: decodificado.id,
      nome: decodificado.nome,
      email: decodificado.email,
      asaasCustomerId: decodificado.asaasCustomerId
    };
    
    // 4. Se não há ID de cliente no Asaas, negar acesso
    if (!req.usuario.asaasCustomerId) {
      return res.status(403).json({
        success: false,
        message: 'Usuário não possui assinatura cadastrada',
        error: 'ERROR_NO_SUBSCRIPTION',
        requiresSubscription: true
      });
    }
    
    // 5. Verificar assinaturas ativas do cliente no Asaas
    try {
      const response = await axios.get(
        `${ASAAS_API_URL}/subscriptions`,
        {
          params: { customer: req.usuario.asaasCustomerId },
          headers: { 
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 6. Verificar se há alguma assinatura ativa
      const assinaturas = response.data.data || [];
      const assinaturaAtiva = assinaturas.find(ass => ass.status === 'ACTIVE');
      
      if (!assinaturaAtiva) {
        return res.status(403).json({
          success: false,
          message: 'Assinatura inativa ou cancelada',
          error: 'ERROR_INACTIVE_SUBSCRIPTION',
          requiresSubscription: true
        });
      }
      
      // 7. Adicionar informações da assinatura à requisição
      req.assinatura = {
        id: assinaturaAtiva.id,
        status: assinaturaAtiva.status,
        valor: assinaturaAtiva.value,
        proxPagamento: assinaturaAtiva.nextDueDate
      };
      
      // 8. Prosseguir para o próximo middleware
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura no Asaas:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        error: 'ERROR_CHECKING_SUBSCRIPTION'
      });
    }
  } catch (error) {
    console.error('Erro não tratado:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}; 