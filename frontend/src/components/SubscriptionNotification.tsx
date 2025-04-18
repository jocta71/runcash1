import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface SubscriptionNotificationProps {
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoClose?: boolean;
  duration?: number;
  onClose?: () => void;
}

/**
 * Componente de notificação específico para eventos de assinatura
 */
const SubscriptionNotification: React.FC<SubscriptionNotificationProps> = ({
  type,
  title,
  message,
  action,
  autoClose = true,
  duration = 5000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  // Fechar notificação automaticamente após a duração especificada
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration]);

  // Manipular fechamento da notificação
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 300); // Aguardar a animação de saída
    }
  };

  // Estilo baseado no tipo
  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-900 border-green-500';
      case 'warning':
        return 'bg-yellow-900 border-yellow-500';
      case 'error':
        return 'bg-red-900 border-red-500';
      case 'info':
      default:
        return 'bg-blue-900 border-blue-500';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-4 right-4 max-w-sm rounded-lg border ${getBackgroundColor()} shadow-md z-50`}
        >
          <div className="flex items-start p-4">
            <div className="flex-1">
              <h3 className="font-medium text-white">{title}</h3>
              <p className="text-sm opacity-80">{message}</p>
              
              {action && (
                <button
                  onClick={action.onClick}
                  className="mt-2 text-sm font-medium hover:underline focus:outline-none text-vegas-gold"
                >
                  {action.label}
                </button>
              )}
            </div>
            
            <button
              onClick={handleClose}
              className="text-white opacity-70 hover:opacity-100 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SubscriptionNotification;

/**
 * Componentes de notificação específicos para cenários comuns
 */

// Notificação para nova assinatura
export const SubscriptionSuccessNotification: React.FC<{ planName: string; onClose?: () => void }> = ({ 
  planName, 
  onClose 
}) => {
  const navigate = useNavigate();
  
  return (
    <SubscriptionNotification
      type="success"
      title="Assinatura ativada com sucesso!"
      message={`Sua assinatura do plano ${planName} foi ativada com sucesso.`}
      action={{
        label: "Ver detalhes",
        onClick: () => navigate('/conta/assinatura')
      }}
      onClose={onClose}
    />
  );
};

// Notificação para pagamento confirmado
export const PaymentConfirmedNotification: React.FC<{ planName: string; onClose?: () => void }> = ({ 
  planName, 
  onClose 
}) => {
  const navigate = useNavigate();
  
  return (
    <SubscriptionNotification
      type="success"
      title="Pagamento confirmado!"
      message={`Seu pagamento para o plano ${planName} foi confirmado.`}
      action={{
        label: "Ver detalhes",
        onClick: () => navigate('/conta/assinatura')
      }}
      onClose={onClose}
    />
  );
};

// Notificação para pagamento pendente
export const PaymentPendingNotification: React.FC<{ 
  planName: string; 
  paymentId: string;
  onClose?: () => void 
}> = ({ 
  planName,
  paymentId,
  onClose 
}) => {
  const navigate = useNavigate();
  
  return (
    <SubscriptionNotification
      type="warning"
      title="Pagamento pendente"
      message={`Seu pagamento para o plano ${planName} está pendente.`}
      action={{
        label: "Finalizar pagamento",
        onClick: () => navigate(`/payment/${paymentId}`)
      }}
      autoClose={false}
      onClose={onClose}
    />
  );
};

// Notificação para pagamento atrasado
export const PaymentOverdueNotification: React.FC<{ 
  planName: string; 
  paymentId: string;
  onClose?: () => void 
}> = ({ 
  planName,
  paymentId,
  onClose 
}) => {
  const navigate = useNavigate();
  
  return (
    <SubscriptionNotification
      type="error"
      title="Pagamento atrasado"
      message={`Sua assinatura do plano ${planName} está com pagamento atrasado.`}
      action={{
        label: "Regularizar agora",
        onClick: () => navigate(`/payment/${paymentId}`)
      }}
      autoClose={false}
      onClose={onClose}
    />
  );
};

// Notificação para assinatura cancelada
export const SubscriptionCanceledNotification: React.FC<{ 
  planName: string;
  endDate: string;
  onClose?: () => void 
}> = ({ 
  planName,
  endDate,
  onClose 
}) => {
  const navigate = useNavigate();
  
  return (
    <SubscriptionNotification
      type="info"
      title="Assinatura cancelada"
      message={`Sua assinatura do plano ${planName} foi cancelada. Você terá acesso até ${new Date(endDate).toLocaleDateString('pt-BR')}.`}
      action={{
        label: "Assinar novamente",
        onClick: () => navigate('/planos')
      }}
      onClose={onClose}
    />
  );
};

// Notificação para renovação próxima
export const SubscriptionRenewalNotification: React.FC<{ 
  planName: string;
  renewalDate: string;
  onClose?: () => void 
}> = ({ 
  planName,
  renewalDate,
  onClose 
}) => {
  const navigate = useNavigate();
  
  return (
    <SubscriptionNotification
      type="info"
      title="Renovação próxima"
      message={`Sua assinatura do plano ${planName} será renovada em ${new Date(renewalDate).toLocaleDateString('pt-BR')}.`}
      action={{
        label: "Ver detalhes",
        onClick: () => navigate('/conta/assinatura')
      }}
      onClose={onClose}
    />
  );
}; 