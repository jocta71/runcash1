import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNotifications } from '@/context/NotificationsContext';
import { 
  SubscriptionSuccessNotification,
  PaymentConfirmedNotification,
  PaymentPendingNotification,
  PaymentOverdueNotification,
  SubscriptionCanceledNotification,
  SubscriptionRenewalNotification
} from './SubscriptionNotification';

/**
 * Componente que escuta eventos relacionados a assinaturas e exibe notificações
 * Este componente não renderiza nada visualmente, apenas manipula eventos
 */
const SubscriptionEventListener: React.FC = () => {
  const location = useLocation();
  const [notificationShown, setNotificationShown] = useState<string | null>(null);
  const { currentSubscription, currentPlan, availablePlans } = useSubscription();
  const { addNotification } = useNotifications();
  
  // Verificar parâmetros da URL para eventos de pagamento/assinatura
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const subscriptionEvent = queryParams.get('subscription_event');
    const paymentEvent = queryParams.get('payment_event');
    const planId = queryParams.get('plan_id');
    const paymentId = queryParams.get('payment_id');
    
    if (subscriptionEvent && planId && !notificationShown) {
      setNotificationShown(subscriptionEvent);
      handleSubscriptionEvent(subscriptionEvent, planId, paymentId);
    } else if (paymentEvent && planId && !notificationShown) {
      setNotificationShown(paymentEvent);
      handlePaymentEvent(paymentEvent, planId, paymentId);
    }
  }, [location.search, notificationShown]);
  
  // Verificar se existem assinaturas com status que requerem atenção
  useEffect(() => {
    if (currentSubscription && currentPlan) {
      // Se houver uma assinatura com pagamento atrasado, notificar o usuário
      if (currentSubscription.status.toLowerCase() === 'overdue' && notificationShown !== 'payment_overdue') {
        setNotificationShown('payment_overdue');
        
        // Adicionar notificação visual
        addNotification({
          type: 'error',
          message: `Sua assinatura do plano ${currentPlan.name} está com pagamento atrasado.`,
          autoClose: false
        });
      }
      
      // Se a assinatura foi recentemente cancelada
      if (currentSubscription.status.toLowerCase() === 'canceled' && notificationShown !== 'subscription_canceled') {
        setNotificationShown('subscription_canceled');
        
        // Adicionar notificação visual se houver data de término
        if (currentSubscription.endDate) {
          addNotification({
            type: 'info',
            message: `Sua assinatura foi cancelada. Você terá acesso até ${new Date(currentSubscription.endDate).toLocaleDateString('pt-BR')}.`,
            autoClose: true,
            duration: 7000
          });
        }
      }
      
      // Verificar se a próxima cobrança está em menos de 3 dias
      if (currentSubscription.nextBillingDate) {
        const nextBilling = new Date(currentSubscription.nextBillingDate);
        const today = new Date();
        const daysUntilRenewal = Math.floor((nextBilling.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilRenewal <= 3 && daysUntilRenewal >= 0 && notificationShown !== 'subscription_renewal') {
          setNotificationShown('subscription_renewal');
          
          // Adicionar notificação visual
          addNotification({
            type: 'info',
            message: `Sua assinatura será renovada em ${daysUntilRenewal === 0 ? 'hoje' : `${daysUntilRenewal} ${daysUntilRenewal === 1 ? 'dia' : 'dias'}`}.`,
            autoClose: true,
            duration: 7000
          });
        }
      }
    }
  }, [currentSubscription, currentPlan, notificationShown, addNotification]);
  
  // Manipulador para eventos de assinatura
  const handleSubscriptionEvent = (event: string, planId: string, paymentId: string | null) => {
    const planName = getPlanName(planId);
    
    switch (event) {
      case 'created':
        // Renderizar notificação de assinatura criada
        return (
          <SubscriptionSuccessNotification 
            planName={planName} 
            onClose={() => setNotificationShown(null)} 
          />
        );
      case 'canceled':
        // Renderizar notificação de assinatura cancelada (se houver data de término)
        if (currentSubscription?.endDate) {
          return (
            <SubscriptionCanceledNotification 
              planName={planName} 
              endDate={currentSubscription.endDate}
              onClose={() => setNotificationShown(null)}
            />
          );
        }
        break;
    }
    
    return null;
  };
  
  // Manipulador para eventos de pagamento
  const handlePaymentEvent = (event: string, planId: string, paymentId: string | null) => {
    const planName = getPlanName(planId);
    
    switch (event) {
      case 'confirmed':
        // Renderizar notificação de pagamento confirmado
        return (
          <PaymentConfirmedNotification 
            planName={planName} 
            onClose={() => setNotificationShown(null)} 
          />
        );
      case 'pending':
        // Renderizar notificação de pagamento pendente (se houver paymentId)
        if (paymentId) {
          return (
            <PaymentPendingNotification 
              planName={planName} 
              paymentId={paymentId}
              onClose={() => setNotificationShown(null)} 
            />
          );
        }
        break;
      case 'overdue':
        // Renderizar notificação de pagamento atrasado (se houver paymentId)
        if (paymentId) {
          return (
            <PaymentOverdueNotification 
              planName={planName} 
              paymentId={paymentId}
              onClose={() => setNotificationShown(null)} 
            />
          );
        }
        break;
    }
    
    return null;
  };
  
  // Função auxiliar para obter o nome do plano a partir do ID
  const getPlanName = (planId: string): string => {
    // Verificar se é um plano atual
    if (currentPlan?.id === planId) {
      return currentPlan.name;
    }
    
    // Caso contrário, buscar nos planos disponíveis
    const plan = availablePlans.find(p => p.id === planId);
    return plan ? plan.name : 'Desconhecido';
  };
  
  // Este componente não renderiza nada visualmente
  return null;
};

export default SubscriptionEventListener; 