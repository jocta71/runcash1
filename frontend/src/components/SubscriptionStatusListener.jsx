import React, { useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import EventService from '../services/EventService';

/**
 * Componente que escuta eventos de status de assinatura e atualiza o contexto
 * Este componente não renderiza nada, apenas atua como intermediário
 */
const SubscriptionStatusListener = () => {
  const { loadUserSubscription } = useSubscription();

  // Escutar o evento subscription_status_updated
  useEffect(() => {
    const handleSubscriptionUpdate = (data) => {
      console.log('[SubscriptionStatusListener] Recebido evento de atualização de status:', data);
      
      // Se tivermos informações reais de assinatura, atualizar o contexto
      if (data && data.subscriptionInfo) {
        console.log('[SubscriptionStatusListener] Atualizando contexto de assinatura com novas informações');
        loadUserSubscription(true); // Force refresh para carregar dados atualizados
      }
    };

    // Escutar eventos de atualização de status
    EventService.on('subscription_status_updated', handleSubscriptionUpdate);

    // Verificar se há dados de alerta armazenados no localStorage
    const checkLocalStorageForAlertData = () => {
      try {
        const alertDataString = localStorage.getItem('subscription_alert_data');
        if (alertDataString) {
          const alertData = JSON.parse(alertDataString);
          const timestamp = new Date(alertData.timestamp);
          const now = new Date();
          
          // Se os dados foram salvos há menos de 5 minutos, usar esses dados
          if (now.getTime() - timestamp.getTime() < 5 * 60 * 1000) {
            console.log('[SubscriptionStatusListener] Usando dados de alerta do localStorage');
            handleSubscriptionUpdate(alertData);
          } else {
            // Dados muito antigos, remover
            localStorage.removeItem('subscription_alert_data');
          }
        }
      } catch (error) {
        console.error('[SubscriptionStatusListener] Erro ao ler dados do localStorage:', error);
      }
    };

    // Verificar localStorage quando o componente montar
    checkLocalStorageForAlertData();

    // Cleanup: remover listener quando o componente desmontar
    return () => {
      EventService.off('subscription_status_updated', handleSubscriptionUpdate);
    };
  }, [loadUserSubscription]);

  // Este componente não renderiza nada
  return null;
};

export default SubscriptionStatusListener; 