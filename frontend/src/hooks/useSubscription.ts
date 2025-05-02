import { PlanType } from '@/types/plans';

// Hook de substituição para o useSubscription
// Retorna dados fictícios para evitar erros nos componentes que dependem dele
export const useSubscription = () => {
  // Simulação de um plano gratuito
  const mockPlan = {
    id: 'premium',
    name: 'Premium',
    type: PlanType.PREMIUM,
    price: 0,
    interval: 'monthly',
    features: ['Todas as funcionalidades'],
    allowedFeatures: ['*'],
    description: 'Acesso a todas as funcionalidades premium'
  };

  // Função que sempre retorna true para permitir acesso a todas as features
  const hasFeatureAccess = (featureId: string): boolean => {
    console.log(`[useSubscription] Verificação de acesso à feature "${featureId}" - concedido (subscription check desativado)`);
    return true;
  };

  // Mock dos métodos que existiam no SubscriptionContext original
  const upgradePlan = async (planId: string): Promise<void> => {
    console.log(`[useSubscription] Atualização para o plano ${planId} solicitada (funcionalidade desativada)`);
    return Promise.resolve();
  };

  const cancelSubscription = async (): Promise<void> => {
    console.log('[useSubscription] Cancelamento de assinatura solicitado (funcionalidade desativada)');
    return Promise.resolve();
  };

  const loadUserSubscription = async (forceRefresh?: boolean): Promise<void> => {
    console.log('[useSubscription] Carregamento de assinatura solicitado (funcionalidade desativada)');
    return Promise.resolve();
  };
  
  // Método para forçar recarregamento da assinatura
  const refetchSubscription = async (): Promise<void> => {
    console.log('[useSubscription] Recarregamento da assinatura solicitado');
    return loadUserSubscription(true);
  };

  return {
    currentSubscription: {
      id: 'mock-subscription',
      status: 'active',
      planId: 'premium',
      startDate: new Date().toISOString(),
      endDate: null,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false
    },
    currentPlan: mockPlan,
    availablePlans: [
      {
        id: 'basic',
        name: 'Básico',
        type: PlanType.BASIC,
        price: 0,
        interval: 'monthly',
        features: ['Acesso às roletas básicas', 'Suporte básico'],
        allowedFeatures: ['basic_roulettes'],
        description: 'Ideal para quem está começando'
      },
      {
        id: 'pro',
        name: 'Profissional',
        type: PlanType.PRO,
        price: 49.90,
        interval: 'monthly',
        features: ['Todas as roletas básicas', 'Acesso às roletas profissionais', 'Suporte prioritário'],
        allowedFeatures: ['basic_roulettes', 'pro_roulettes'],
        description: 'Perfeito para apostadores intermediários'
      },
      {
        id: 'premium',
        name: 'Premium',
        type: PlanType.PREMIUM,
        price: 99.90,
        interval: 'monthly',
        features: ['Acesso a todas as roletas', 'Estatísticas avançadas', 'Suporte VIP 24/7'],
        allowedFeatures: ['*'],
        description: 'Completo para apostadores profissionais'
      }
    ],
    loading: false,
    error: null,
    hasFeatureAccess,
    upgradePlan,
    cancelSubscription,
    loadUserSubscription,
    refetchSubscription
  };
}; 