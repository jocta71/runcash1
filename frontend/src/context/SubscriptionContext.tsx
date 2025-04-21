import React, { createContext, useContext, useState, useEffect } from 'react';
import { Plan, PlanType, UserSubscription } from '@/types/plans';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { API_URL } from '@/config/constants';

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
  error: string | null;
  hasFeatureAccess: (featureId: string) => boolean;
  upgradePlan: (planId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  loadUserSubscription: (forceRefresh?: boolean) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Provedor de assinatura que busca os dados reais da API
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, syncUserWithAsaas } = useAuth();
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar assinatura do usuário
  const loadUserSubscription = async (forceRefresh = false): Promise<void> => {
    if (!user) {
      setCurrentSubscription(null);
      setCurrentPlan(null);
      setLoading(false);
      return;
    }

    console.log(`[SubscriptionContext] Carregando assinatura para usuário ${user.id} (forceRefresh: ${forceRefresh})`);
    setLoading(true);
    setError(null);

    let retryCount = 0;
    const maxRetries = forceRefresh ? 3 : 1;
    let lastError = null;

    // Verificar se o usuário tem um ID do Asaas
    if (!user.asaasCustomerId) {
      console.log('[SubscriptionContext] Usuário não possui asaasCustomerId, tentando sincronizar com Asaas...');
      try {
        // Tentar sincronizar o usuário com o Asaas
        const syncResult = await syncUserWithAsaas();
        if (!syncResult) {
          console.error('[SubscriptionContext] Falha ao sincronizar usuário com Asaas');
          setError('Não foi possível sincronizar seu usuário com o sistema de pagamentos.');
          setLoading(false);
          return;
        }
        
        // Verificar novamente após a sincronização
        if (!user.asaasCustomerId) {
          console.log('[SubscriptionContext] Usuário ainda sem asaasCustomerId após sincronização, definindo plano gratuito');
          setCurrentSubscription(null);
          const freePlan = availablePlans.find(p => p.id === 'free') || null;
          setCurrentPlan(freePlan);
          setLoading(false);
          return;
        }
      } catch (syncError) {
        console.error('[SubscriptionContext] Erro ao sincronizar com Asaas:', syncError);
        setError('Não foi possível sincronizar seu usuário com o sistema de pagamentos.');
        setLoading(false);
        return;
      }
    }

    // Se mesmo após a tentativa de sincronização ainda não há ID do Asaas, continuar com plano gratuito
    if (!user.asaasCustomerId) {
      console.log('[SubscriptionContext] Usuário sem asaasCustomerId após sincronização, definindo plano gratuito');
      setCurrentSubscription(null);
      const freePlan = availablePlans.find(p => p.id === 'free') || null;
      setCurrentPlan(freePlan);
      setLoading(false);
      return;
    }

    while (retryCount < maxRetries) {
      try {
        // Adicionar um parâmetro de timestamp para evitar cache
        const cacheKey = forceRefresh ? `&_t=${Date.now()}` : '';
        
        console.log(`[SubscriptionContext] Buscando assinatura para customerId ${user.asaasCustomerId} (tentativa ${retryCount + 1})`);
        
        // Tentar alternativa de API unificada primeiro
        let response;
        try {
          // Buscar assinatura ativa do usuário usando o ID do cliente no Asaas - API unificada
          response = await axios.get(`${API_URL}/api/asaas-api`, {
            params: {
              path: 'find-subscription',
              customerId: user.asaasCustomerId,
              _t: forceRefresh ? Date.now() : undefined
            }
          });
        } catch (apiError) {
          console.error(`[SubscriptionContext] Erro na API unificada, tentando endpoint específico:`, apiError);
          // Se falhar, tentar a URL antiga
          response = await axios.get(`${API_URL}/api/asaas-find-subscription?customerId=${user.asaasCustomerId}${cacheKey}`);
        }

        if (response.data && response.data.success && response.data.subscriptions && response.data.subscriptions.length > 0) {
          const subscriptionData = response.data.subscriptions[0];
          console.log(`[SubscriptionContext] Assinatura encontrada:`, subscriptionData);
          
          // Converter dados da API para o formato UserSubscription
          const formattedSubscription: UserSubscription = {
            id: subscriptionData.id,
            userId: user.id,
            planId: 'premium', // Valor temporário, depois será baseado no valor ou descrição
            planType: getPlanTypeFromId('premium'), // Valor temporário
            startDate: new Date(subscriptionData.createdDate),
            endDate: null,
            status: subscriptionData.status,
            paymentMethod: subscriptionData.billingType,
            paymentProvider: 'ASAAS',
            nextBillingDate: subscriptionData.nextDueDate ? new Date(subscriptionData.nextDueDate) : null
          };

          console.log('[SubscriptionContext] Assinatura formatada:', formattedSubscription);
          
          // Determinar o plano com base no valor da assinatura
          let planId = 'free';
          if (subscriptionData.value >= 99) {
            planId = 'premium';
          } else if (subscriptionData.value >= 49) {
            planId = 'pro';
          } else if (subscriptionData.value >= 19) {
            planId = 'basic';
          }
          
          // Atualizar o planId na assinatura
          formattedSubscription.planId = planId;
          formattedSubscription.planType = getPlanTypeFromId(planId);
          
          const plan = availablePlans.find(p => p.id === planId) || null;
          if (!plan) {
            console.warn(`[SubscriptionContext] Plano não encontrado para ID: ${planId}`);
          }
          
          setCurrentSubscription(formattedSubscription);
          setCurrentPlan(plan);
          // Sucesso! Sair do loop
          break;
        } else {
          // Sem assinatura ativa, definir como plano gratuito
          console.log('[SubscriptionContext] Nenhuma assinatura encontrada, definindo plano gratuito');
          setCurrentSubscription(null);
          const freePlan = availablePlans.find(p => p.id === 'free') || null;
          setCurrentPlan(freePlan);
          // Também sair do loop, pois não é um erro
          break;
        }
      } catch (err: any) {
        console.error(`[SubscriptionContext] Erro ao carregar assinatura (tentativa ${retryCount + 1}):`, err);
        lastError = err;
        
        // Se o erro for 404, significa que não há assinatura (não é realmente um erro)
        if (err.response && err.response.status === 404) {
          console.log('[SubscriptionContext] Erro 404 - Nenhuma assinatura encontrada, definindo plano gratuito');
          setCurrentSubscription(null);
          const freePlan = availablePlans.find(p => p.id === 'free') || null;
          setCurrentPlan(freePlan);
          // Sair do loop, pois é uma situação esperada
          break;
        }

        // Se não for 404, incrementar contagem de retry
        retryCount++;
        
        // Se não atingimos o número máximo de retries, aguardar antes de tentar novamente
        if (retryCount < maxRetries) {
          const retryDelay = 1000 * retryCount; // Aumentar o tempo de espera a cada tentativa
          console.log(`[SubscriptionContext] Aguardando ${retryDelay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // Se todas as tentativas falharam e não é um erro 404, mostrar mensagem de erro
    if (retryCount === maxRetries && lastError) {
      console.error('[SubscriptionContext] Todas as tentativas falharam');
      setError('Não foi possível carregar informações da sua assinatura. Tente novamente mais tarde.');
    }

    setLoading(false);
  };

  // Função auxiliar para determinar o tipo de plano a partir do ID
  const getPlanTypeFromId = (planId: string): PlanType => {
    switch (planId) {
      case 'basic': return PlanType.BASIC;
      case 'pro': return PlanType.PRO;
      case 'premium': return PlanType.PREMIUM;
      default: return PlanType.FREE;
    }
  };

  // Verificar se o usuário tem acesso a um recurso específico
  const hasFeatureAccess = (featureId: string): boolean => {
    if (!currentPlan) return false;
    
    // Se o plano atual permite este recurso
    return currentPlan.allowedFeatures.includes(featureId);
  };

  // Atualizar plano do usuário
  const upgradePlan = async (planId: string): Promise<void> => {
    if (!user) {
      throw new Error('Você precisa estar logado para alterar seu plano');
    }

    try {
      // Aqui redirecionaria para a página de pagamento
      // Esta função seria chamada a partir da página de planos
      // e o redirecionamento já acontece lá
      console.log(`Iniciando upgrade para o plano ${planId}`);
    } catch (err: any) {
      console.error('Erro ao iniciar upgrade de plano:', err);
      throw new Error('Não foi possível iniciar o processo de upgrade. Tente novamente mais tarde.');
    }
  };

  // Cancelar assinatura atual
  const cancelSubscription = async (): Promise<void> => {
    if (!user || !currentSubscription) {
      throw new Error('Você não possui uma assinatura ativa para cancelar');
    }

    try {
      await axios.post(`${API_URL}/api/asaas-api?path=cancel-subscription`, {
        subscriptionId: currentSubscription.id
      });

      // Atualizar estado local após cancelamento
      await loadUserSubscription();
    } catch (err: any) {
      console.error('Erro ao cancelar assinatura:', err);
      throw new Error('Não foi possível cancelar sua assinatura. Tente novamente mais tarde.');
    }
  };

  // Carregar assinatura quando o usuário mudar
  useEffect(() => {
    loadUserSubscription();
  }, [user?.id]);

  return (
    <SubscriptionContext.Provider
      value={{
        currentSubscription,
        currentPlan,
        availablePlans,
        loading,
        error,
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