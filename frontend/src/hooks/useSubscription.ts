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
    allowedFeatures: ['*']
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
    availablePlans: [mockPlan],
    loading: false,
    error: null,
    hasFeatureAccess,
    upgradePlan,
    cancelSubscription,
    loadUserSubscription
  };
}; 