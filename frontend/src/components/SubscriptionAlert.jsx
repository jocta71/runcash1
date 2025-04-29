import React, { useState, useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import '../styles/SubscriptionAlert.css';

/**
 * Componente que exibe um alerta pulsante com informações de assinatura
 * quando o status não está ativo ou em modo de fallback
 */
const SubscriptionAlert = () => {
  const { currentSubscription, currentPlan, error } = useSubscription();
  const [visible, setVisible] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    // Definir as informações do alerta com base no status da assinatura
    if (currentSubscription) {
      // Verificar se está em modo fallback ou com status não ativo
      const isFallbackMode = currentSubscription.status === 'FALLBACK_MODE';
      const isInactive = currentSubscription.status !== 'ACTIVE' && 
                         currentSubscription.status !== 'active';
      
      if (isFallbackMode || isInactive) {
        const message = isFallbackMode
          ? 'Serviço de assinaturas em manutenção. Fornecendo acesso temporário.'
          : `Status da assinatura: ${currentSubscription.status}`;
        
        const planInfo = currentPlan 
          ? `Plano: ${currentPlan.name} - ${currentPlan.description}`
          : 'Plano não identificado';
        
        setAlertInfo({
          message,
          planInfo,
          status: currentSubscription.status,
          type: isFallbackMode ? 'warning' : (isInactive ? 'error' : 'info')
        });
        
        setVisible(true);
      } else {
        setVisible(false);
      }
    } else if (error) {
      // Se houve erro ao carregar a assinatura
      setAlertInfo({
        message: 'Erro ao verificar assinatura',
        planInfo: error,
        status: 'ERROR',
        type: 'error'
      });
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [currentSubscription, currentPlan, error]);

  // Efeito de pulsação a cada 3 segundos
  useEffect(() => {
    if (visible) {
      const interval = setInterval(() => {
        setPulsing(true);
        setTimeout(() => setPulsing(false), 500);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [visible]);

  // Se não estiver visível, não renderizar
  if (!visible || !alertInfo) return null;

  return (
    <div className={`subscription-alert ${alertInfo.type} ${pulsing ? 'pulse' : ''}`}>
      <div className="alert-content">
        <div className="alert-header">
          <span className="alert-icon">⚠️</span>
          <h4>{alertInfo.message}</h4>
          <button 
            className="close-button" 
            onClick={() => setVisible(false)}
          >
            &times;
          </button>
        </div>
        <div className="alert-body">
          <p>{alertInfo.planInfo}</p>
          {alertInfo.status !== 'FALLBACK_MODE' && (
            <p>Para desbloquear todos os recursos, ative sua assinatura.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionAlert; 