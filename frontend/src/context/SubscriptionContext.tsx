import React, { createContext, useContext, useState, useEffect } from 'react';
import { Plan, PlanType, UserSubscription } from '@/types/plans';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { API_URL } from '@/config/constants';

// Lista de planos disponíveis
export const availablePlans: Plan[] = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    type: PlanType.FREE,
    description: 'Acesso básico para experimentar a plataforma',
    interval: 'monthly',
    features: [
      'Acesso ao histórico limitado',
      'Estatísticas básicas',
      'Consulta manual de resultados'
    ],
    allowedFeatures: [
      'basic-stats',
      'manual-history'
    ]
  },
  {
    id: 'basic',
    name: 'Básico',
    price: 29.90,
    type: PlanType.BASIC,
    description: 'Ideal para iniciantes',
    interval: 'monthly',
    features: [
      'Acesso ao histórico completo',
      'Estatísticas avançadas',
      'Alertas personalizados',
      'Dados em tempo real'
    ],
    allowedFeatures: [
      'basic-stats',
      'manual-history',
      'advanced-stats',
      'custom-alerts',
      'realtime-data-access'
    ]
  },
  {
    id: 'pro',
    name: 'Profissional',
    price: 59.90,
    type: PlanType.PRO,
    description: 'Para usuários experientes',
    interval: 'monthly',
    features: [
      'Todas as funcionalidades do plano Básico',
      'Estratégias automáticas',
      'Análise em multi-roletas',
      'Suporte prioritário'
    ],
    allowedFeatures: [
      'basic-stats',
      'manual-history',
      'advanced-stats',
      'custom-alerts',
      'auto-strategies',
      'multi-roulette',
      'priority-support',
      'realtime-data-access'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 99.90,
    type: PlanType.PREMIUM,
    description: 'Experiência completa e sem restrições',
    interval: 'monthly',
    features: [
      'Todas as funcionalidades dos planos anteriores',
      'Estratégias personalizadas avançadas',
      'Acesso a recursos experimentais',
      'Atendimento personalizado'
    ],
    allowedFeatures: [
      'basic-stats',
      'manual-history',
      'advanced-stats',
      'custom-alerts',
      'auto-strategies',
      'multi-roulette',
      'priority-support',
      'advanced-custom-strategies',
      'experimental-features',
      'premium-support',
      'realtime-data-access'
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
    
    // Normalizar o status da assinatura (priorizar pagamento pendente)
    let normalizedStatus = subscriptionData.status;
    
    // Se o status vindo do backend for "pending", ou se houver pagamento pendente,
    // garantir que o status exibido seja "pending"
    if (hasPendingPayment || 
        subscriptionData.status?.toLowerCase() === 'pending' || 
        subscriptionData.status?.toLowerCase() === 'pendente') {
      normalizedStatus = 'pending';
      console.log('[SubscriptionContext] Status normalizado para "pending" devido a pagamento pendente');
    }
    
    // Converter dados da API para o formato UserSubscription
    const formattedSubscription: UserSubscription = {
      id: subscriptionData.id,
      userId: user!.id,
      planId: 'premium', // Valor temporário, depois será baseado no valor ou descrição
      planType: getPlanTypeFromId('premium'), // Valor temporário
      startDate: new Date(subscriptionData.createdDate),
      endDate: null,
      status: normalizedStatus,
      paymentMethod: subscriptionData.billingType,
      paymentProvider: 'ASAAS',
      nextBillingDate: subscriptionData.nextDueDate ? new Date(subscriptionData.nextDueDate) : null
    };
    
    // Determinar o plano com base no valor e status da assinatura
    let planId = 'free';
    const isActive = normalizedStatus.toLowerCase() === 'active' || normalizedStatus.toLowerCase() === 'ativo';
    
    // Apenas atribuir plano pago se a assinatura estiver ativa
    if (isActive) {
      if (subscriptionData.value >= 99) {
        planId = 'premium';
      } else if (subscriptionData.value >= 49) {
        planId = 'pro';
      } else if (subscriptionData.value >= 19) {
        planId = 'basic';
      }
    } else {
      console.log(`[SubscriptionContext] Usando plano FREE porque a assinatura não está ativa (status: ${normalizedStatus})`);
    }
    
    // Atualizar o planId na assinatura
    formattedSubscription.planId = planId;
    formattedSubscription.planType = getPlanTypeFromId(planId);
    
    console.log('[SubscriptionContext] Assinatura carregada:', formattedSubscription);
    setCurrentSubscription(formattedSubscription);

    // Buscar plano correspondente na lista de planos disponíveis
    const plan = availablePlans.find(p => p.id === planId) || null;
    setCurrentPlan(plan);
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
  const hasFeatureAccess = (featureId: string): boolean => {
    // Se não há plano atual, não tem acesso
    if (!currentPlan) {
      console.log(`[SubscriptionContext] Acesso negado a "${featureId}": usuário sem plano`);
      return false;
    }
    
    // Se for plano gratuito, verificar se o recurso está disponível para free
    if (currentPlan.type === PlanType.FREE) {
      const hasAccess = currentPlan.allowedFeatures.includes(featureId);
      console.log(`[SubscriptionContext] Plano gratuito - acesso a "${featureId}": ${hasAccess ? 'permitido' : 'negado'}`);
      return hasAccess;
    }
    
    // Para planos pagos, verificar se a assinatura está ativa (não pendente/cancelada)
    const isSubscriptionActive = currentSubscription && 
      (currentSubscription.status === 'active' || currentSubscription.status === 'ativo');
    
    // Se a assinatura não estiver ativa, o usuário não tem acesso aos recursos pagos
    if (!isSubscriptionActive) {
      console.log(`[SubscriptionContext] Acesso negado a "${featureId}": assinatura não está ativa (status: ${currentSubscription?.status || 'nenhum'})`);
      return false;
    }
    
    // Se o plano atual permite este recurso e a assinatura está ativa
    const hasAccess = currentPlan.allowedFeatures.includes(featureId);
    console.log(`[SubscriptionContext] Plano pago (${currentPlan.id}) - acesso a "${featureId}": ${hasAccess ? 'permitido' : 'negado'}`);
    return hasAccess;
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

  // Efeito para carregar assinatura quando o usuário fizer login
  useEffect(() => {
    if (user) {
      console.log('[SubscriptionContext] Usuário autenticado, carregando informações de assinatura...');
    loadUserSubscription();
    } else {
      // Limpar informações de assinatura quando o usuário deslogar
      setCurrentSubscription(null);
      setCurrentPlan(null);
      setLoading(false);
    }
  }, [user]);

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