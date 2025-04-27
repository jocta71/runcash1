import React, { createContext, useContext, useState, useEffect } from 'react';
import { Plan, PlanType, UserSubscription } from '@/types/plans';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { apiService } from '@/services/apiService';

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
              
              // Agora podemos verificar o status da assinatura usando o endpoint
              try {
                // Tentar endpoint unificado primeiro
                console.log('[SubscriptionContext] Tentando endpoint unificado para verificação de status');
                const response = await apiService.checkSubscriptionStatus();
                if (response.data && response.data.success) {
                  processSubscriptionResponse(response.data);
                  break;
                } else {
                  handleNoSubscription();
                  break;
                }
              } catch (statusError) {
                console.error('[SubscriptionContext] Erro ao verificar status da assinatura:', statusError);
                
                // Tentar rota alternativa se a principal falhar
                try {
                  console.log('[SubscriptionContext] Tentando endpoint alternativo (asaas) para verificação de status');
                  const altResponse = await apiService.get(`/api/subscription/status/asaas`);
                  if (altResponse.data && altResponse.data.success) {
                    processSubscriptionResponse(altResponse.data);
                    break;
                  } else {
                    handleNoSubscription();
                    break;
                  }
                } catch (altError) {
                  console.error('[SubscriptionContext] Erro no endpoint alternativo:', altError);
                  handleNoSubscription();
                  break;
                }
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
          // Usuário já tem asaasCustomerId, usar novo endpoint para verificar status
          console.log(`[SubscriptionContext] Verificando status da assinatura com customerId: ${user.asaasCustomerId}`);
          
          try {
            // Tentar endpoint unificado primeiro
            console.log('[SubscriptionContext] Tentando endpoint unificado para verificação de status');
            const response = await apiService.checkSubscriptionStatus();
            
            if (response.data && response.data.success) {
              processSubscriptionResponse(response.data);
              break;
            } else {
              // Mesmo com resposta "success: false", processamos para obter info de status
              processSubscriptionResponse(response.data);
              break;
            }
          } catch (statusError) {
            console.error('[SubscriptionContext] Erro ao verificar status da assinatura:', statusError);
            
            // Tentar rota alternativa se a principal falhar
            try {
              console.log('[SubscriptionContext] Tentando endpoint alternativo (asaas) para verificação de status');
              const altResponse = await apiService.get(`/api/subscription/status/asaas`);
              if (altResponse.data && altResponse.data.success) {
                processSubscriptionResponse(altResponse.data);
                break;
              } else {
                // Se o erro for 404, significa que o endpoint não existe ainda (fallback para método antigo)
                if (statusError.response && statusError.response.status === 404) {
                  console.log('[SubscriptionContext] Endpoint não encontrado, usando método antigo de consulta');
                  try {
                    const fallbackResponse = await axios.get(`${API_URL}/api/asaas-find-subscription?customerId=${user.asaasCustomerId}`);
                    if (fallbackResponse.data && fallbackResponse.data.success && fallbackResponse.data.subscriptions && fallbackResponse.data.subscriptions.length > 0) {
                      processSubscriptionResponse(fallbackResponse.data);
                      break;
                    } else {
                      handleNoSubscription();
                      break;
                    }
                  } catch (fallbackError) {
                    console.error('[SubscriptionContext] Erro no método antigo:', fallbackError);
                    throw fallbackError;
                  }
                } else {
                  handleNoSubscription();
                  break;
                }
              }
            } catch (altError) {
              console.error('[SubscriptionContext] Erro no endpoint alternativo:', altError);
              
              // Tentar método antigo como último recurso
              try {
                console.log('[SubscriptionContext] Tentando método antigo de consulta como último recurso');
                const fallbackResponse = await axios.get(`${API_URL}/api/asaas-find-subscription?customerId=${user.asaasCustomerId}`);
                if (fallbackResponse.data && fallbackResponse.data.success && fallbackResponse.data.subscriptions && fallbackResponse.data.subscriptions.length > 0) {
                  processSubscriptionResponse(fallbackResponse.data);
                  break;
                } else {
                  handleNoSubscription();
                  break;
                }
              } catch (fallbackError) {
                console.error('[SubscriptionContext] Erro no método antigo:', fallbackError);
                throw fallbackError;
              }
            }
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
    // Verificar o formato dos dados (endpoint antigo ou novo)
    if (data.subscriptions && data.subscriptions.length > 0) {
      // Formato antigo: { subscriptions: [...] }
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
      
      // Construir objeto de assinatura normalizado
      const newSubscription: UserSubscription = {
        id: subscriptionData.id,
        customerId: subscriptionData.customer,
        status: normalizedStatus,
        planId: subscriptionData.billingType || getPlanTypeFromId(subscriptionData.billingType || ''),
        createdAt: subscriptionData.dateCreated,
        nextDueDate: subscriptionData.nextDueDate,
        lastPaymentDate: subscriptionData.lastBillingDate || null,
        value: subscriptionData.value || 0
      };
      
      setCurrentSubscription(newSubscription);
      
      // Determinar plano atual
      const planType = getPlanTypeFromId(subscriptionData.billingType || '');
      const plan = availablePlans.find(p => p.type === planType) || null;
      setCurrentPlan(plan);
      
      console.log('[SubscriptionContext] Assinatura atualizada:', newSubscription);
    } else if (data.subscription && data.hasActiveSubscription) {
      // Formato novo: { subscription: {...}, hasActiveSubscription: true }
      const subscriptionData = data.subscription;
      
      // Verificar se há pagamentos pendentes
      const hasPendingPayment = data.pendingPayments && data.pendingPayments.length > 0;
      
      // Normalizar o status da assinatura
      let normalizedStatus = subscriptionData.status;
      
      if (hasPendingPayment) {
        normalizedStatus = 'pending';
        console.log('[SubscriptionContext] Status normalizado para "pending" devido a pagamento pendente');
      }
      
      // Mapear o tipo de plano
      const planType = getPlanTypeFromId(subscriptionData.billingType || '');
      
      // Construir objeto de assinatura normalizado
      const newSubscription: UserSubscription = {
        id: subscriptionData.id,
        customerId: subscriptionData.customer,
        status: normalizedStatus,
        planId: subscriptionData.billingType || planType,
        createdAt: subscriptionData.dateCreated,
        nextDueDate: subscriptionData.nextDueDate,
        lastPaymentDate: subscriptionData.lastBillingDate || null,
        value: subscriptionData.value || 0
      };
      
      setCurrentSubscription(newSubscription);
      
      // Determinar plano atual
      const plan = availablePlans.find(p => p.type === planType) || null;
      setCurrentPlan(plan);
      
      console.log('[SubscriptionContext] Assinatura atualizada (novo formato):', newSubscription);
    } else {
      // Formato inesperado ou sem assinatura
      console.warn('[SubscriptionContext] Formato de resposta inesperado ou sem assinatura ativa:', data);
      handleNoSubscription();
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
  const hasFeatureAccess = (featureId: string): boolean => {
    // Se não há plano atual, não tem acesso
    if (!currentPlan) return false;
    
    // Se for plano gratuito, verificar se o recurso está disponível para free
    if (currentPlan.type === PlanType.FREE) {
      return currentPlan.allowedFeatures.includes(featureId);
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