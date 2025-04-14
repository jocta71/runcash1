import React, { createContext, useContext, useState } from 'react';
import { Plan, PlanType, UserSubscription } from '@/types/plans';

// Lista de planos disponíveis (apenas Básico e Profissional)
export const availablePlans: Plan[] = [
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
  }
];

// Adicionar versões anuais dos planos
availablePlans.push(
  {
    id: 'basic',
    name: 'Básico',
    type: PlanType.BASIC,
    description: 'Plano ideal para iniciantes',
    price: 19.90 * 10, // Desconto de 2 meses no plano anual
    interval: 'annual',
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
    price: 49.90 * 10, // Desconto de 2 meses no plano anual
    interval: 'annual',
    features: [
      'Acesso a estatísticas avançadas',
      'Visualização de roletas ilimitadas',
      'Atualizações a cada 1 minuto',
      'Suporte prioritário',
      'Alertas personalizados'
    ],
    allowedFeatures: ['view_advanced_stats', 'view_unlimited_roulettes', 'priority_support', 'custom_alerts']
  }
);

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

// Versão mock do SubscriptionProvider que sempre fornece acesso premium
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sempre usar o plano pro como padrão
  const proPlan = availablePlans.find(plan => plan.id === 'pro' && plan.interval === 'monthly') || availablePlans[1];
  
  // Estado inicial com plano pro
  const [currentSubscription] = useState<UserSubscription | null>({
    id: 'mock-subscription',
    userId: 'mock-user',
    planId: 'pro',
    planType: PlanType.PRO,
    startDate: new Date(),
    endDate: null,
    status: 'active',
    paymentMethod: 'mock',
    paymentProvider: 'manual',
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  });
  
  const [currentPlan] = useState<Plan | null>(proPlan);
  const [loading] = useState(false);

  // Função mock para carregar assinatura (não faz nada)
  const loadUserSubscription = async (): Promise<void> => {
    // Não faz nada, já que o estado inicial já inclui o plano pro
    return Promise.resolve();
  };

  // Sempre retorna true para qualquer recurso
  const hasFeatureAccess = (featureId: string): boolean => {
    return true;
  };

  // Funções mock para upgrade e cancelamento (não fazem nada)
  const upgradePlan = async (planId: string): Promise<void> => {
    console.log(`Upgrade para o plano ${planId} simulado com sucesso`);
    return Promise.resolve();
  };

  const cancelSubscription = async (): Promise<void> => {
    console.log('Cancelamento de assinatura simulado com sucesso');
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