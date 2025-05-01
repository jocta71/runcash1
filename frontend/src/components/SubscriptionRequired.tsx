import React, { useState, useEffect } from 'react';

interface SubscriptionRequiredProps {
  onClose?: () => void;
  message?: string;
}

/**
 * Componente que exibe uma mensagem quando o usuário precisa de assinatura
 * para acessar os dados de roletas.
 */
const SubscriptionRequired: React.FC<SubscriptionRequiredProps> = ({ 
  onClose, 
  message = 'Para acessar os dados de roletas em tempo real, é necessário ter uma assinatura ativa.' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  
  useEffect(() => {
    // Registrar listener para eventos de assinatura requerida
    const handleSubscriptionRequired = (event: CustomEvent<any>) => {
      console.log('[SubscriptionRequired] Evento subscription:required recebido:', event.detail);
      setIsVisible(true);
      // Armazenar detalhes do erro para exibição
      if (event.detail) {
        setErrorDetails(event.detail);
      }
    };
    
    window.addEventListener('subscription:required', handleSubscriptionRequired as EventListener);
    
    return () => {
      window.removeEventListener('subscription:required', handleSubscriptionRequired as EventListener);
    };
  }, []);
  
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };
  
  const redirectToSubscription = () => {
    // Redirecionar para a página de assinatura
    window.location.href = '/subscription';
  };
  
  if (!isVisible) return null;
  
  // Determinar a mensagem a ser exibida
  const displayMessage = errorDetails?.message || message;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Assinatura Necessária</h3>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-6">
          <div className="text-yellow-500 mb-4 text-center text-6xl">
            🔒
          </div>
          <p className="text-gray-700 mb-4">{displayMessage}</p>
          <p className="text-gray-600 text-sm mb-4">
            Com uma assinatura ativa, você terá acesso a todas as roletas, estatísticas avançadas 
            e dados históricos completos para melhorar seus resultados.
          </p>
          
          {/* Exibir detalhes de erro se disponíveis */}
          {errorDetails && (
            <div className="bg-gray-100 p-3 rounded-md text-xs text-gray-600 mb-4">
              <p><strong>Tipo:</strong> {errorDetails.error || 'Acesso restrito'}</p>
              {errorDetails.requiredTypes && (
                <p><strong>Planos necessários:</strong> {Array.isArray(errorDetails.requiredTypes) 
                  ? errorDetails.requiredTypes.join(', ') 
                  : errorDetails.requiredTypes}</p>
              )}
              {errorDetails.currentType && (
                <p><strong>Seu plano atual:</strong> {errorDetails.currentType}</p>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
          >
            Fechar
          </button>
          <button
            onClick={redirectToSubscription}
            className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-700"
          >
            Ver Planos
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionRequired; 