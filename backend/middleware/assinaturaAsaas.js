const axios = require('axios');

// Configurações do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

/**
 * Middleware para verificar se o usuário possui assinatura premium ativa no Asaas
 */
exports.verificarAssinaturaPremium = async (req, res, next) => {
  try {
    // Verificar se o usuário está autenticado
    if (!req.usuario || !req.usuario.asaasCustomerId) {
      return res.status(403).json({
        success: false,
        message: 'Usuário sem assinatura cadastrada',
        error: 'SEM_ASSINATURA',
        dadosSimulados: true
      });
    }
    
    // Consultar API do Asaas para verificar assinaturas do cliente
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
      
      // Verificar se há alguma assinatura premium ativa
      const assinaturas = response.data.data || [];
      const assinaturaPremium = assinaturas.find(ass => 
        ass.status === 'ACTIVE' && 
        (ass.planType === 'PRO' || ass.description?.includes('Premium'))
      );
      
      if (!assinaturaPremium) {
        return res.status(403).json({
          success: false,
          message: 'Assinatura premium não encontrada ou inativa',
          error: 'ASSINATURA_PREMIUM_REQUERIDA',
          dadosSimulados: true
        });
      }
      
      // Adicionar informações da assinatura à requisição
      req.assinatura = {
        id: assinaturaPremium.id,
        status: assinaturaPremium.status,
        tipo: assinaturaPremium.planType,
        valor: assinaturaPremium.value,
        proxPagamento: assinaturaPremium.nextDueDate
      };
      
      // Prosseguir para o próximo middleware
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura no Asaas:', error.message);
      // Em caso de erro na verificação, negar acesso aos dados reais
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura premium',
        error: 'ERRO_VERIFICACAO_ASSINATURA',
        dadosSimulados: true
      });
    }
  } catch (error) {
    console.error('Erro não tratado:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor',
      error: 'ERRO_INTERNO',
      dadosSimulados: true
    });
  }
}; 