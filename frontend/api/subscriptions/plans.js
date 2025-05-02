/**
 * API serverless para listar planos de assinatura (Vercel)
 * Proxy para redirecionar para API do backend
 */

import axios from 'axios';

// Planos padrão em caso de falha
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

export default async function handler(req, res) {
  // Verificar se é uma solicitação GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido'
    });
  }

  try {
    // Se estiver executando em ambiente de desenvolvimento, usar localhost
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    // Fazer a chamada para o backend
    const response = await axios.get(`${backendUrl}/api/subscriptions/plans`);
    
    // Retornar os dados do backend
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro ao buscar planos disponíveis:', error);
    
    // Em caso de erro, retornar os planos padrão
    return res.status(200).json({
      success: true,
      message: 'Planos padrão retornados devido a falha na API',
      plans: DEFAULT_PLANS
    });
  }
} 