import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PlanType } from '@/types/plans';

interface Subscription {
  id: string;
  status: string;
  planId: string;
  startDate: string;
  endDate: any;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  features: string[];
}

interface SubscriptionHook {
  currentSubscription: Subscription | null;
  currentPlan: Plan | null;
  availablePlans: Plan[];
  loading: boolean;
  error: string | null;
  loadUserSubscription: (forceRefresh?: boolean) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

// Planos padrão
const DEFAULT_PLANS: Plan[] = [
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

export function useSubscription(): SubscriptionHook {
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadUserSubscription = async (forceRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get('/api/subscriptions/status');
      
      if (response.data && response.data.success) {
        setCurrentSubscription(response.data.subscription || null);
        
        // Se tiver um plano ativo, buscar os detalhes do plano
        if (response.data.subscription && response.data.subscription.planId) {
          const planId = response.data.subscription.planId;
          const plan = availablePlans.find(p => p.id === planId) || DEFAULT_PLANS.find(p => p.id === planId);
          setCurrentPlan(plan || null);
        } else {
          setCurrentPlan(null);
        }
      } else {
        setCurrentSubscription(null);
        setCurrentPlan(null);
      }
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err);
      setError('Falha ao verificar assinatura');
      setCurrentSubscription(null);
      setCurrentPlan(null);
    } finally {
      setLoading(false);
    }
  };

  // Função de refresh para facilitar o uso
  const refreshSubscription = async () => {
    return loadUserSubscription(true);
  };

  // Carregar planos disponíveis
  const loadAvailablePlans = async () => {
    try {
      const response = await axios.get('/api/subscriptions/plans');
      if (response.data && response.data.success && Array.isArray(response.data.plans)) {
        if (response.data.plans.length > 0) {
          setAvailablePlans(response.data.plans);
        } else {
          setAvailablePlans(DEFAULT_PLANS);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar planos disponíveis:', err);
      setAvailablePlans(DEFAULT_PLANS);
    }
  };

  useEffect(() => {
    loadAvailablePlans();
    loadUserSubscription();
  }, [user]);

  return {
    currentSubscription,
    currentPlan,
    availablePlans,
    loading,
    error,
    loadUserSubscription,
    refreshSubscription
  };
}

// Hook de substituição para o useSubscription
// Retorna dados fictícios para evitar erros nos componentes que dependem dele
export const useSubscriptionMock = () => {
  // Simulação de um plano gratuito
  const mockPlan = {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    interval: 'monthly',
    description: 'Acesso básico às funcionalidades da plataforma',
    features: ['Acesso limitado às roletas', 'Visualização de números recentes']
  };
  
  // Simulação de planos disponíveis
  const mockAvailablePlans = [
    mockPlan,
    {
      id: 'basic',
      name: 'Básico',
      price: 29.90,
      interval: 'monthly',
      description: 'Acesso completo à plataforma',
      features: ['Acesso a todas as roletas', 'Estatísticas básicas', 'Histórico de 7 dias']
    },
    {
      id: 'pro',
      name: 'Profissional',
      price: 49.90,
      interval: 'monthly',
      description: 'Acesso completo com estatísticas avançadas',
      features: ['Tudo do plano Básico', 'Estatísticas avançadas', 'Histórico completo', 'Suporte prioritário']
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 99.90,
      interval: 'monthly',
      description: 'Experiência completa sem limitações',
      features: ['Tudo do plano Profissional', 'Acesso antecipado a novas funcionalidades', 'Suporte 24/7']
    }
  ];
  
  return {
    currentSubscription: null,
    currentPlan: null,
    availablePlans: mockAvailablePlans,
    loading: false,
    error: null,
    loadUserSubscription: async () => {},
    refreshSubscription: async () => {}
  };
}; 