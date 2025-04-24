import React, { createContext, useContext, useState, useEffect } from 'react';
import { Plan, PlanType, UserSubscription } from '@/types/plans';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { setSubscriptionContext } from '@/integrations/api/rouletteApi';

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
      'Visualização completa dos cartões de roleta',
      'Acesso ao painel lateral de estatísticas',
      'Atualizações a cada 5 minutos',
      'Suporte por email'
    ],
    allowedFeatures: [
      'view_basic_stats', 
      'view_standard_roulettes', 
      'view_roulette_cards',
      'view_roulette_sidepanel',
      'email_support'
    ]
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
      'Visualização completa dos cartões de roleta',
      'Acesso ao painel lateral de estatísticas',
      'Atualizações a cada 1 minuto',
      'Suporte prioritário',
      'Alertas personalizados'
    ],
    allowedFeatures: [
      'view_advanced_stats', 
      'view_unlimited_roulettes', 
      'view_roulette_cards',
      'view_roulette_sidepanel',
      'priority_support', 
      'custom_alerts'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    type: PlanType.PREMIUM,
    description: 'Experiência completa com todos os recursos exclusivos',
    price: 99.90,
    interval: 'monthly',
    features: [
      'Todos os recursos do plano Profissional',
      'API dedicada para integração',
      'Visualização completa dos cartões de roleta',
      'Acesso ao painel lateral de estatísticas',
      'Modelo de IA avançado para previsões',
      'Acesso a dados históricos completos',
      'Suporte técnico 24/7',
      'Sessão de consultoria personalizada'
    ],
    allowedFeatures: [
      'view_advanced_stats', 
      'view_unlimited_roulettes', 
      'view_historical_data', 
      'api_access', 
      'ai_predictions',
      'view_roulette_cards',
      'view_roulette_sidepanel',
      'priority_support', 
      'custom_alerts', 
      'personalized_consulting'
    ]
  }
];

interface SubscriptionContextType {
  currentSubscription: UserSubscription | null;
  currentPlan: Plan | null;
  availablePlans: Plan[];
  loading: boolean;
  error: string | null;
  hasFeatureAccess: (featureId: string) => Promise<boolean>;
  upgradePlan: (planId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  loadUserSubscription: (forceRefresh?: boolean) => Promise<void>;
}

// Criar contexto com valor padrão
const SubscriptionContext = createContext<SubscriptionContextType>({
  currentSubscription: null,
  currentPlan: null,
  availablePlans: [],
  loading: false,
  error: null,
  hasFeatureAccess: async () => false,
  upgradePlan: async () => {},
  cancelSubscription: async () => {},
  loadUserSubscription: async () => {}
});

// Provedor de assinatura que busca os dados reais da API
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser } = useAuth();
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

    setLoading(true);
    setError(null);

    let retryCount = 0;
    const maxRetries = forceRefresh ? 3 : 1;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        // Adicionar um parâmetro de timestamp para evitar cache
        const cacheKey = forceRefresh ? `&_t=${Date.now()}` : '';
        
        // Verificar se o usuário já tem um ID de cliente Asaas
        if (!user.asaasCustomerId) {
          console.log('[SubscriptionContext] Usuário não possui asaasCustomerId, tentando criar ou recuperar cliente no Asaas...');
          try {
            // Tentar encontrar cliente existente por email ou criar um novo
            const customerResponse = await axios.post(`${API_URL}/api/asaas-create-customer`, {
              name: user.username,
              email: user.email,
              externalReference: user.id // Usar ID do usuário como referência externa
            });
            
            if (customerResponse.data && customerResponse.data.success) {
              console.log('[SubscriptionContext] Cliente Asaas criado/recuperado com sucesso:', customerResponse.data);
              
              // Obter o ID do cliente
              const customerId = customerResponse.data.id || customerResponse.data.customerId;
              
              // Atualizar o usuário com o ID do cliente Asaas
              await updateUserAsaasId(customerId, user);
              
              // Buscar assinatura com o customerId recuperado
              const response = await axios.get(`${API_URL}/api/asaas-find-subscription?customerId=${customerId}${cacheKey}`);
              
              // Processar resposta (código existente)
              if (response.data && response.data.success && response.data.subscriptions && response.data.subscriptions.length > 0) {
                processSubscriptionResponse(response.data);
                break;
              } else {
                handleNoSubscription();
                break;
              }
            } else {
              console.error('[SubscriptionContext] Falha ao criar/recuperar cliente Asaas:', customerResponse.data);
              throw new Error('Falha ao criar/recuperar cliente Asaas');
            }
          } catch (customerError) {
            console.error('[SubscriptionContext] Erro ao criar/recuperar cliente Asaas:', customerError);
            throw customerError; // Propagar erro para o tratamento existente
          }
        } else {
          // Usuário já tem asaasCustomerId, usar diretamente
          console.log(`[SubscriptionContext] Buscando assinatura com customerId: ${user.asaasCustomerId}`);
          const response = await axios.get(`${API_URL}/api/asaas-find-subscription?customerId=${user.asaasCustomerId}${cacheKey}`);
          
          if (response.data && response.data.success && response.data.subscriptions && response.data.subscriptions.length > 0) {
            processSubscriptionResponse(response.data);
            break;
          } else {
            handleNoSubscription();
            break;
          }
        }
      } catch (err: any) {
        console.error(`[SubscriptionContext] Erro ao carregar assinatura (tentativa ${retryCount + 1}):`, err);
        lastError = err;
        
        // Se o erro for 404, significa que não há assinatura (não é realmente um erro)
        if (err.response && err.response.status === 404) {
          console.log('[SubscriptionContext] Erro 404 - Nenhuma assinatura encontrada');
          handleNoSubscription();
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

  // Função auxiliar para processar a resposta de assinatura
  const processSubscriptionResponse = (data: any) => {
    const subscriptionData = data.subscriptions[0];
    
    // Verificar se há status de pagamento pendente
    const hasPendingPayment = data.payments && 
      data.payments.some(payment => 
        payment.status?.toLowerCase() === 'pending' || 
        payment.status?.toLowerCase() === 'pendente'
      );
    
    // Normalizar o status da assinatura
    let normalizedStatus = subscriptionData.status?.toLowerCase() || '';
    
    // Verificar se o status é ativo (considerando variações de maiúsculas/minúsculas)
    const isActive = ['active', 'ativo', 'activo'].includes(normalizedStatus);
    
    console.log(`[SubscriptionContext] Assinatura encontrada: ID=${subscriptionData.id}, Status=${subscriptionData.status}, Valor=${subscriptionData.value}`);
    
    // Determinar o plano com base no valor e na descrição da assinatura
    let planId = 'free';
    
    if (isActive) {
      // Tentar determinar o plano pela descrição primeiro
      const description = subscriptionData.description?.toLowerCase() || '';
      if (description.includes('premium')) {
        planId = 'premium';
      } else if (description.includes('pro')) {
        planId = 'pro';
      } else if (description.includes('básico') || description.includes('basico')) {
        planId = 'basic';
      } else {
        // Se não conseguir pela descrição, usar o valor
        if (subscriptionData.value >= 99) {
          planId = 'premium';
        } else if (subscriptionData.value >= 49) {
          planId = 'pro';
        } else if (subscriptionData.value >= 19) {
          planId = 'basic';
        }
      }
      
      console.log(`[SubscriptionContext] Plano determinado: ${planId.toUpperCase()} (baseado no valor: ${subscriptionData.value} e descrição: "${subscriptionData.description}")`);
    } else {
      console.log(`[SubscriptionContext] Usando plano FREE porque a assinatura não está ativa (status: ${normalizedStatus})`);
    }
    
    // Converter dados da API para o formato UserSubscription
    const formattedSubscription: UserSubscription = {
      id: subscriptionData.id,
      userId: user!.id,
      planId: planId,
      planType: getPlanTypeFromId(planId),
      startDate: new Date(subscriptionData.createdDate),
      endDate: null,
      status: subscriptionData.status,
      paymentMethod: subscriptionData.billingType,
      paymentProvider: 'ASAAS',
      nextBillingDate: subscriptionData.nextDueDate ? new Date(subscriptionData.nextDueDate) : null
    };
    
    console.log('[SubscriptionContext] Assinatura processada:', {
      id: formattedSubscription.id,
      status: formattedSubscription.status,
      planId: formattedSubscription.planId,
      planType: formattedSubscription.planType
    });
    
    setCurrentSubscription(formattedSubscription);

    // Buscar plano correspondente na lista de planos disponíveis
    const plan = availablePlans.find(p => p.id === planId) || null;
    if (plan) {
      setCurrentPlan(plan);
      console.log(`[SubscriptionContext] Features permitidas: ${plan.allowedFeatures?.join(', ') || 'nenhuma'}`);
    } else {
      console.error(`[SubscriptionContext] Plano não encontrado: ${planId}`);
      // Usar plano free como fallback
      setCurrentPlan(availablePlans.find(p => p.id === 'free') || null);
    }
  };

  // Função auxiliar para lidar com caso de nenhuma assinatura encontrada
  const handleNoSubscription = () => {
    console.log('[SubscriptionContext] Nenhuma assinatura encontrada');
    setCurrentSubscription(null);
    const freePlan = availablePlans.find(p => p.id === 'free') || null;
    setCurrentPlan(freePlan);
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
  const hasFeatureAccess = async (featureId: string): Promise<boolean> => {
    // Se não há plano atual, não tem acesso
    if (!currentPlan) return false;
    
    // Se não há usuário autenticado, não tem acesso (exceto para features FREE)
    if (!user) {
      // Verificar se é uma feature disponível no plano FREE
      return currentPlan.type === PlanType.FREE && 
        currentPlan.allowedFeatures.includes(featureId);
    }
    
    // Função de verificação local de permissões (para reutilização)
    const checkLocalAccess = (): boolean => {
      console.log(`[SubscriptionContext] Verificando acesso a feature "${featureId}" localmente`);
      
      // Verificar se a assinatura está ativa
      const isSubscriptionActive = currentSubscription && 
        (currentSubscription.status === 'active' || currentSubscription.status === 'ativo');
      
      // Se for plano FREE ou assinatura ativa, verificar se a feature está na lista de permissões
      if (currentPlan.type === PlanType.FREE || isSubscriptionActive) {
        const hasAccess = currentPlan.allowedFeatures.includes(featureId);
        console.log(`[SubscriptionContext] Acesso a feature "${featureId}" ${hasAccess ? 'permitido' : 'negado'} no plano ${currentPlan.type}`);
        return hasAccess;
      }
      
      console.log(`[SubscriptionContext] Acesso negado: assinatura não está ativa (${currentSubscription?.status || 'nenhuma'})`);
      return false;
    };
    
    // Primeiro, tentar verificar com os dados que já temos carregados
    if (currentSubscription && currentPlan) {
      return checkLocalAccess();
    }
    
    try {
      // Se não temos os dados carregados ou é forçada uma atualização, recarregar
      if (!currentSubscription || !currentPlan) {
        console.log(`[SubscriptionContext] Recarregando dados da assinatura para verificar acesso a "${featureId}"`);
        await loadUserSubscription(true);
        
        // Verificar novamente após recarregar
        return checkLocalAccess();
      }
      
      // Tentar fazer a verificação via API apenas como segunda opção
      try {
        console.log(`[SubscriptionContext] Tentando verificar acesso a feature "${featureId}" via API`);
        const response = await axios.get(`${API_URL}/api/subscription/check-access/${featureId}`);
        
        if (response.data && response.data.success) {
          const hasAccess = response.data.hasAccess;
          console.log(`[SubscriptionContext] Resposta da API para feature "${featureId}": ${hasAccess ? 'Acesso permitido' : 'Acesso negado'}`);
          
          // Se o usuário tem acesso a uma feature superior ao seu plano atual,
          // atualizar o plano no frontend para refletir o que o backend reportou
          if (hasAccess && response.data.planType) {
            // Converter o tipo de plano da API para o enum PlanType
            const planTypeFromAPI = 
              response.data.planType === 'PREMIUM' ? PlanType.PREMIUM :
              response.data.planType === 'PRO' ? PlanType.PRO :
              response.data.planType === 'BASIC' ? PlanType.BASIC : 
              PlanType.FREE;
              
            // Se o plano do backend for superior ao atual, atualizar
            if (
              (planTypeFromAPI === PlanType.PREMIUM && currentPlan.type !== PlanType.PREMIUM) ||
              (planTypeFromAPI === PlanType.PRO && 
                (currentPlan.type !== PlanType.PRO && currentPlan.type !== PlanType.PREMIUM)) ||
              (planTypeFromAPI === PlanType.BASIC && 
                (currentPlan.type === PlanType.FREE))
            ) {
              console.log(`[SubscriptionContext] Atualizando plano de ${currentPlan.type} para ${planTypeFromAPI} baseado na resposta da API`);
              
              // Encontrar o plano correspondente
              const newPlan = availablePlans.find(p => p.type === planTypeFromAPI) || null;
              if (newPlan) {
                setCurrentPlan(newPlan);
              }
            }
          }
          
          return hasAccess;
        }
        
        // Se houve erro na API, usar verificação local
        console.log(`[SubscriptionContext] Erro na resposta da API, usando validação local para "${featureId}"`);
        return checkLocalAccess();
      } catch (apiError) {
        console.log(`[SubscriptionContext] API de verificação não disponível, usando validação local para "${featureId}"`);
        return checkLocalAccess();
      }
    } catch (error) {
      console.error(`[SubscriptionContext] Erro ao verificar acesso a feature "${featureId}":`, error);
      
      // Em caso de erro, negar acesso por segurança
      return false;
    }
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
      await axios.post(`${API_URL}/api/asaas-cancel-subscription`, {
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

  // Função para atualizar o ID do cliente Asaas do usuário no banco de dados e localmente
  const updateUserAsaasId = async (customerId: string, userData: any) => {
    try {
      console.log(`[SubscriptionContext] Atualizando usuário com asaasCustomerId: ${customerId}`);
      
      // Chamar API para atualizar o usuário no banco de dados
      const updateResponse = await axios.post(`${API_URL}/api/update-user`, {
        asaasCustomerId: customerId,
        userId: userData.id // Enviar userId explicitamente para o caso do JWT falhar
      });
      
      if (updateResponse.data.success) {
        // Atualizar o objeto de usuário local (se setUser estiver disponível)
        if (setUser && typeof setUser === 'function') {
          setUser({
            ...userData,
            asaasCustomerId: customerId
          });
          console.log('[SubscriptionContext] Usuário atualizado localmente com asaasCustomerId');
        } else {
          console.log('[SubscriptionContext] setUser não disponível, impossível atualizar usuário localmente');
        }
        return true;
      } else {
        console.error('[SubscriptionContext] Erro ao atualizar usuário:', updateResponse.data.error);
        return false;
      }
    } catch (error) {
      console.error('[SubscriptionContext] Erro ao atualizar asaasCustomerId do usuário:', error);
      // Mesmo com erro na API, atualizar localmente
      if (setUser && typeof setUser === 'function') {
        setUser({
          ...userData,
          asaasCustomerId: customerId
        });
        console.log('[SubscriptionContext] Usuário atualizado apenas localmente devido a erro na API');
        return true;
      }
      return false;
    }
  };

  useEffect(() => {
    // Configurar contexto de assinatura global para a API
    // Garantir que hasFeatureAccess está disponível e configurada
    try {
      console.log('[SubscriptionContext] Configurando contexto global para APIs...');
      setSubscriptionContext({
        hasFeatureAccess
      });
      console.log('[SubscriptionContext] Contexto de assinatura configurado para APIs');
      
      // Informações detalhadas para diagnóstico
      if (currentPlan) {
        console.log(`[SubscriptionContext] Plano atual: ${currentPlan.name} (${currentPlan.type})`);
        console.log(`[SubscriptionContext] Features permitidas: ${currentPlan.allowedFeatures?.join(', ') || 'nenhuma'}`);
      } else {
        console.log('[SubscriptionContext] Nenhum plano configurado ainda');
      }
      
      if (currentSubscription) {
        console.log(`[SubscriptionContext] Status da assinatura: ${currentSubscription.status}`);
      } else {
        console.log('[SubscriptionContext] Nenhuma assinatura configurada ainda');
      }
    } catch (error) {
      console.error('[SubscriptionContext] Erro ao configurar contexto global:', error);
    }
  }, [currentSubscription, currentPlan, hasFeatureAccess]);

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