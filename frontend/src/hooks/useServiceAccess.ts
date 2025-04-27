import { useEffect, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';
import RESTSocketService from '@/services/RESTSocketService';
import { EventService } from '@/services/EventService';

// Identificador do recurso de dados em tempo real
const REALTIME_DATA_FEATURE_ID = 'realtime-data-access';

/**
 * Hook para gerenciar o acesso aos serviços de dados em tempo real
 * com base no plano do usuário
 */
export function useServiceAccess() {
  const { user } = useAuth();
  const { currentSubscription, hasFeatureAccess, loading: subscriptionLoading } = useSubscription();
  const [servicesConfigured, setServicesConfigured] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Verificar e configurar acesso aos serviços com base na assinatura
  useEffect(() => {
    if (subscriptionLoading) {
      console.log('[useServiceAccess] Carregando informações de assinatura...');
      return;
    }

    // Verificar acesso com base no recurso de dados em tempo real
    const accessAllowed = hasFeatureAccess(REALTIME_DATA_FEATURE_ID);
    setHasAccess(accessAllowed);
    
    console.log(`[useServiceAccess] Status de acesso: ${accessAllowed ? 'Permitido' : 'Bloqueado'}`);
    
    // Obter instâncias dos serviços
    const socketService = RESTSocketService.getInstance();
    const eventService = EventService.getInstance();
    
    // Atualizar status de acesso nos serviços
    socketService.updateAccessStatus(accessAllowed);
    eventService.updateAccessStatus(accessAllowed);
    
    setServicesConfigured(true);
    
    // Log detalhado para depuração
    if (currentSubscription) {
      console.log(`[useServiceAccess] Assinatura atual: ${currentSubscription.planId} (${currentSubscription.status})`);
    } else {
      console.log('[useServiceAccess] Usuário sem assinatura');
    }
  }, [subscriptionLoading, hasFeatureAccess, currentSubscription, user]);

  return {
    hasAccess,
    servicesConfigured,
    isLoading: subscriptionLoading
  };
} 