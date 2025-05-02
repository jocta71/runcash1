import React, { useState, useEffect } from 'react';
import EventService from '../services/EventService';

interface SubscriptionRequiredModalProps {
  onClose?: () => void;
  onUpgrade?: () => void;
}

/**
 * Modal que é exibido quando o usuário tenta acessar recursos que requerem assinatura
 */
const SubscriptionRequiredModal: React.FC<SubscriptionRequiredModalProps> = ({
  onClose,
  onUpgrade
}) => {
  const [visible, setVisible] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    // Escutar o evento de assinatura necessária
    const handleSubscriptionRequired = (data: any) => {
      console.log('[SubscriptionModal] Evento de assinatura necessária recebido', data);
      setMessage(data.message || 'É necessário ter uma assinatura para acessar este recurso');
      setCode(data.code || 'SUBSCRIPTION_REQUIRED');
      setDetails(data.details || null);
      setVisible(true);
    };

    // Escutar evento de resolução de assinatura
    const handleSubscriptionResolved = () => {
      console.log('[SubscriptionModal] Evento de resolução de assinatura recebido');
      setVisible(false);
    };

    // Registrar listeners
    EventService.on('roulette:subscription-required', handleSubscriptionRequired);
    EventService.on('roulette:subscription-resolved', handleSubscriptionResolved);

    // Limpar listeners
    return () => {
      EventService.off('roulette:subscription-required', handleSubscriptionRequired);
      EventService.off('roulette:subscription-resolved', handleSubscriptionResolved);
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };

  const handleUpgrade = () => {
    setVisible(false);
    if (onUpgrade) onUpgrade();
    else {
      // Redirecionar para a página de planos por padrão
      window.location.href = '/plans';
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-lg">
        <div className="text-center mb-4">
          <svg
            className="w-16 h-16 mx-auto text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-center mb-2 dark:text-white">
          Assinatura Necessária
        </h3>

        <p className="text-gray-700 dark:text-gray-300 mb-6 text-center">
          {message}
        </p>

        {code === 'PLAN_UPGRADE_REQUIRED' && details && (
          <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Seu plano atual: <strong>{details.currentPlan}</strong>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Planos necessários: <strong>{details.requiredPlans}</strong>
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleUpgrade}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Fazer Upgrade
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionRequiredModal; 