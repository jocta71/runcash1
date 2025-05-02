/**
 * API fallback que retorna dados padrão para teste
 * Útil quando o backend não está disponível
 */

// Planos padrão para retornar no fallback
const DEFAULT_PLANS = [
  {
    id: 'basic',
    name: 'Plano Básico',
    price: 49.90,
    interval: 'monthly',
    description: 'Ideal para iniciantes',
    features: [
      'Acesso a todas as roletas',
      'Estatísticas básicas',
      'Números recentes',
      'Suporte por email'
    ]
  },
  {
    id: 'pro',
    name: 'Plano Profissional',
    price: 49.90,
    interval: 'monthly',
    description: 'Melhor custo-benefício',
    features: [
      'Acesso a todas as roletas',
      'Estatísticas avançadas',
      'Histórico completo',
      'Atualizações em tempo real',
      'Suporte prioritário'
    ]
  },
  {
    id: 'premium',
    name: 'Plano Premium',
    price: 99.90,
    interval: 'monthly',
    description: 'Para profissionais exigentes',
    features: [
      'Tudo do plano Profissional',
      'Dados históricos avançados',
      'Acesso prioritário ao suporte',
      'Previsões com IA',
      'Sem limitações de uso'
    ]
  }
];

export default function handler(req, res) {
  const path = req.url.split('/').filter(Boolean);
  const endpoint = path[path.length - 1];
  
  // Responder conforme o endpoint solicitado
  switch (endpoint) {
    case 'plans':
      return res.status(200).json({
        success: true,
        message: 'Planos padrão do fallback',
        plans: DEFAULT_PLANS,
        _source: 'Fallback API'
      });
      
    case 'status':
      return res.status(200).json({
        success: true,
        message: 'Status de assinatura do fallback',
        hasActiveSubscription: false,
        subscription: {
          status: 'inactive',
          plan: null,
          features: []
        },
        _source: 'Fallback API'
      });
      
    default:
      return res.status(404).json({
        success: false,
        message: 'Endpoint não encontrado',
        _source: 'Fallback API'
      });
  }
} 