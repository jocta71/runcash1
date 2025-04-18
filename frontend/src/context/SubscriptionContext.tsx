import React, { createContext, useContext, useState } from 'react';
import { Plan, PlanType, UserSubscription } from '@/types/plans';

// Lista de planos disponíveis
export const availablePlans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    type: PlanType.FREE,
    description: 'Acesso básico para experimentar a plataforma',
    price: 0,
    interval: 'monthly',
    features: [
      'Acesso a estatísticas básicas',
      'Visualização de até 5 roletas',
      'Atualizações a cada 10 minutos'
    ],
    allowedFeatures: ['view_basic_stats', 'view_limited_roulettes']
  },
  {
    id: 'basic',
    name: 'Básico',
    type: PlanType.BASIC,
    description: 'Plano ideal para iniciantes',
    price: 19.90,
    interval: 'monthly',
    features: [
      'Acesso a estatísticas padrão',
      'Visualização de até 15 roletas',
      'Atualizações a cada 5 minutos',
      'Suporte por email'
    ],
    allowedFeatures: ['view_basic_stats', 'view_standard_roulettes', 'email_support']
  },
  {
    id: 'pro',
    name: 'Profissional',
    type: PlanType.PRO,
    description: 'Para jogadores que querem levar o jogo a sério',
    price: 49.90,
    interval: 'monthly',
    features: [
      'Acesso a estatísticas avançadas',
      'Visualização de roletas ilimitadas',
      'Atualizações a cada 1 minuto',
      'Suporte prioritário',
      'Alertas personalizados'
    ],
    allowedFeatures: ['view_advanced_stats', 'view_unlimited_roulettes', 'priority_support', 'custom_alerts']
  },
  {
    id: 'premium',
    name: 'Premium',
    type: PlanType.PREMIUM,
    description: 'Experiência completa para profissionais',
    price: 99.90,
    interval: 'monthly',
    features: [
      'Acesso a estatísticas em tempo real',
      'Visualização de roletas ilimitadas',
      'Atualizações em tempo real',
      'Suporte VIP 24/7',
      'Alertas avançados personalizados',
      'Estratégias exclusivas',
      'Acesso antecipado a novas funcionalidades'
    ],
    allowedFeatures: [
      'view_realtime_stats', 
      'view_unlimited_roulettes', 
      'vip_support', 
      'advanced_alerts', 
      'exclusive_strategies', 
      'early_access'
    ]
  }
];

// Definição do Contexto
interface SubscriptionContextType {
  availablePlans: Plan[];
  currentPlan: Plan | null;
  currentSubscription: UserSubscription | null;
  loading: boolean;
  error: string | null;
  cancelSubscription: () => Promise<boolean>;
  refreshUserSubscription: () => Promise<void>;
}

// Estado inicial do contexto
const initialState: SubscriptionContextType = {
  availablePlans,
  currentPlan: null,
  currentSubscription: null,
  loading: false,
  error: null,
  cancelSubscription: async () => false,
  refreshUserSubscription: async () => {}
};

// Criação do contexto
const SubscriptionContext = createContext<SubscriptionContextType>(initialState);

// Provedor do contexto
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar a assinatura atual do usuário
  const refreshUserSubscription = async () => {
    try {
      setLoading(true);
      // Simular busca na API
      // TODO: Implementar busca real na API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Dados simulados - em produção, buscar da API
      const userPlanId = 'pro'; // Simular plano ativo
      const matchingPlan = availablePlans.find(plan => plan.id === userPlanId) || null;
      
      if (matchingPlan) {
        setCurrentPlan(matchingPlan);
        setCurrentSubscription({
          id: 'sub-123',
          subscriptionId: 'asaas-sub-123', // ID da assinatura no ASAAS
          status: 'active',
          planId: matchingPlan.id,
          startDate: new Date().toISOString(),
          endDate: null,
          nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          autoRenew: true
        });
      }
      
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar assinatura:', err);
      setError('Falha ao carregar informações de assinatura');
    } finally {
      setLoading(false);
    }
  };

  // Função para cancelar assinatura
  const cancelSubscription = async (): Promise<boolean> => {
    try {
      setLoading(true);
      // Simular chamada à API
      // TODO: Implementar cancelamento real
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Atualizar estado
      if (currentSubscription) {
        setCurrentSubscription({
          ...currentSubscription,
          status: 'canceled',
          endDate: new Date().toISOString(),
          autoRenew: false
        });
      }
      
      setError(null);
      return true;
    } catch (err) {
      console.error('Erro ao cancelar assinatura:', err);
      setError('Falha ao cancelar assinatura');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Buscar assinatura ao montar o componente
  React.useEffect(() => {
    refreshUserSubscription();
  }, []);

  const value: SubscriptionContextType = {
    availablePlans,
    currentPlan,
    currentSubscription,
    loading,
    error,
    cancelSubscription,
    refreshUserSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Hook para usar o contexto
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription deve ser usado dentro de um SubscriptionProvider');
  }
  return context;
}; 