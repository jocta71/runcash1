/**
 * API de fallback para subscrições
 * Fornece dados estáticos quando o backend principal está indisponível
 */

// Planos de assinatura para fallback
const PLANOS = [
  {
    id: 'basic',
    nome: 'Básico',
    valor: 'R$ 49,90',
    valorCentavos: 4990,
    periodo: 'mensal',
    recursos: [
      'Acesso às roletas',
      'Histórico de números',
      'Suporte por email'
    ],
    destaque: false,
    cor: 'blue'
  },
  {
    id: 'premium',
    nome: 'Premium',
    valor: 'R$ 99,90',
    valorCentavos: 9990,
    periodo: 'mensal',
    recursos: [
      'Acesso a todas as roletas',
      'Histórico completo',
      'Análises avançadas',
      'Suporte prioritário'
    ],
    destaque: true,
    cor: 'purple'
  },
  {
    id: 'pro',
    nome: 'Profissional',
    valor: 'R$ 179,90',
    valorCentavos: 17990,
    periodo: 'mensal',
    recursos: [
      'Tudo do Premium',
      'Acesso a recursos beta',
      'Consultoria personalizada',
      'API exclusiva',
      'Suporte 24/7'
    ],
    destaque: false,
    cor: 'green'
  }
];

/**
 * Handler para API de fallback
 * Simula diferentes respostas de API com base no endpoint solicitado
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
export default async function handler(req, res) {
  // Simular pequeno atraso para realismo
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verificar se é apenas uma verificação de disponibilidade
  if (req.query.check === 'true') {
    return res.status(200).json({
      status: 'ok',
      mode: 'fallback',
      message: 'Fallback API is available'
    });
  }
  
  // Verificar se existe cabeçalho de autorização
  const hasAuth = req.headers.authorization && 
                  req.headers.authorization.startsWith('Bearer ');
  
  // Lidar com diferentes endpoints
  const endpoint = req.query.endpoint || 'default';
  
  switch (endpoint) {
    case 'status':
      // Simular resposta de status de assinatura
      if (!hasAuth) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'Authentication required to check subscription status'
        });
      }
      
      // Gerar uma data futura para próxima cobrança
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      
      return res.status(200).json({
        hasActiveSubscription: true,
        subscription: {
          id: 'fallback-sub-123',
          plan: 'PREMIUM',
          status: 'ACTIVE',
          nextDueDate: nextDueDate.toISOString(),
          createdAt: new Date().toISOString()
        },
        message: 'Subscription status from fallback API'
      });
      
    case 'planos':
      // Simular resposta com planos disponíveis
      return res.status(200).json({
        plans: PLANOS,
        message: 'Plans from fallback API'
      });
      
    case 'verify':
      // Simular verificação de acesso a recurso
      if (!hasAuth) {
        return res.status(401).json({
          error: 'Not authenticated',
          hasAccess: false,
          message: 'Authentication required to verify access'
        });
      }
      
      return res.status(200).json({
        hasAccess: true,
        subscription: {
          plan: 'PREMIUM',
          status: 'ACTIVE'
        },
        message: 'Access granted from fallback API'
      });
      
    case 'history':
      // Simular histórico de assinaturas
      if (!hasAuth) {
        return res.status(401).json({
          error: 'Not authenticated',
          message: 'Authentication required to check subscription history'
        });
      }
      
      const historyDate = new Date();
      historyDate.setMonth(historyDate.getMonth() - 1);
      
      return res.status(200).json({
        subscriptions: [
          {
            id: 'fallback-sub-123',
            plan: 'PREMIUM',
            status: 'ACTIVE',
            startDate: historyDate.toISOString(),
            nextDueDate: new Date().toISOString(),
            paymentMethod: 'CREDIT_CARD',
            value: 9990
          }
        ],
        message: 'Subscription history from fallback API'
      });
      
    default:
      // Resposta genérica para outros endpoints
      return res.status(200).json({
        status: 'ok',
        mode: 'fallback',
        message: 'Fallback API is responding with default data',
        timestamp: new Date().toISOString()
      });
  }
} 