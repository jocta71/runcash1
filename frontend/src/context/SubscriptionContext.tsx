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

interface SubscriptionContextType {
  currentSubscription: UserSubscription | null;
  currentPlan: Plan | null;
  availablePlans: Plan[];
  loading: boolean;
  hasFeatureAccess: (featureId: string) => boolean;
  upgradePlan: (planId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  loadUserSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Versão modificada do SubscriptionProvider que sempre fornece acesso premium sem autenticação
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sempre usar o plano premium como padrão
  const premiumPlan = availablePlans.find(plan => plan.id === 'premium') || availablePlans[3];
  
  // Estado inicial com plano premium
  const [currentSubscription] = useState<UserSubscription | null>({
    id: 'free-premium-access',
    userId: 'guest-user',
    planId: 'premium',
    planType: PlanType.PREMIUM,
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Acesso por 1 ano
    status: 'active',
    paymentMethod: 'free',
    paymentProvider: 'none',
    nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  });
  
  const [currentPlan] = useState<Plan | null>(premiumPlan);
  const [loading] = useState(false);

  // Função mock para carregar assinatura (não faz nada)
  const loadUserSubscription = async (): Promise<void> => {
    console.log('[SubscriptionContext] Acesso premium concedido para usuário livre');
    return Promise.resolve();
  };

  // Sempre retorna true para qualquer recurso - acesso livre a todas funcionalidades
  const hasFeatureAccess = (featureId: string): boolean => {
    console.log(`[SubscriptionContext] Acesso concedido para recurso: ${featureId}`);
    return true;
  };

  // Funções mock para upgrade e cancelamento (não fazem nada)
  const upgradePlan = async (planId: string): Promise<void> => {
    console.log(`[SubscriptionContext] Upgrade para o plano ${planId} não necessário - já usando Premium`);
    return Promise.resolve();
  };

  const cancelSubscription = async (): Promise<void> => {
    console.log('[SubscriptionContext] Cancelamento não necessário - plano gratuito');
    return Promise.resolve();
  };

  return (
    <SubscriptionContext.Provider
      value={{
        currentSubscription,
        currentPlan,
        availablePlans,
        loading,
        hasFeatureAccess,
        upgradePlan,
        cancelSubscription,
        loadUserSubscription
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}; 