import React, { useState, useEffect, useRef } from 'react';

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
  const [isRetrying, setIsRetrying] = useState(false);
  const lastShownTimeRef = useRef<number>(0);
  const ignoreEventsTimeoutRef = useRef<boolean>(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Registrar listener para eventos de assinatura requerida
    const handleSubscriptionRequired = (event: CustomEvent<any>) => {
      console.log('[SubscriptionRequired] Evento subscription:required recebido:', event.detail);
      
      // Verificar se o modal foi exibido recentemente (nos últimos 30 segundos)
      const now = Date.now();
      const timeSinceLastShown = now - lastShownTimeRef.current;
      
      // Ignorar eventos repetidos em um curto período de tempo
      if (ignoreEventsTimeoutRef.current || timeSinceLastShown < 30000) {
        console.log('[SubscriptionRequired] Ignorando evento repetido para evitar modal pegajoso');
        return;
      }
      
      // Atualizar o timestamp da última exibição
      lastShownTimeRef.current = now;
      
      // Definir um período de tempo em que eventos adicionais serão ignorados
      ignoreEventsTimeoutRef.current = true;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      
      timeoutIdRef.current = setTimeout(() => {
        ignoreEventsTimeoutRef.current = false;
      }, 10000); // Ignorar novos eventos por 10 segundos
      
      setIsVisible(true);
      // Armazenar detalhes do erro para exibição
      if (event.detail) {
        setErrorDetails({
          ...event.detail,
          errorType: 'required'
        });
      }
    };
    
    // Registrar listener para eventos de assinatura inativa
    const handleSubscriptionInactive = (event: CustomEvent<any>) => {
      console.log('[SubscriptionRequired] Evento subscription:inactive recebido:', event.detail);
      
      // Verificar se o modal foi exibido recentemente
      const now = Date.now();
      const timeSinceLastShown = now - lastShownTimeRef.current;
      
      // Ignorar eventos repetidos em um curto período de tempo
      if (ignoreEventsTimeoutRef.current || timeSinceLastShown < 30000) {
        console.log('[SubscriptionRequired] Ignorando evento inactive repetido para evitar modal pegajoso');
        return;
      }
      
      // Atualizar o timestamp da última exibição
      lastShownTimeRef.current = now;
      
      // Definir um período de tempo em que eventos adicionais serão ignorados
      ignoreEventsTimeoutRef.current = true;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      
      timeoutIdRef.current = setTimeout(() => {
        ignoreEventsTimeoutRef.current = false;
      }, 10000); // Ignorar novos eventos por 10 segundos
      
      setIsVisible(true);
      // Armazenar detalhes do erro para exibição
      if (event.detail) {
        setErrorDetails({
          ...event.detail,
          error: 'SUBSCRIPTION_INACTIVE',
          message: event.detail.message || 'Sua assinatura existe mas não está ativa. Verifique o status do pagamento.',
          errorType: 'inactive'
        });
      }
    };
    
    window.addEventListener('subscription:required', handleSubscriptionRequired as EventListener);
    window.addEventListener('subscription:inactive', handleSubscriptionInactive as EventListener);
    
    return () => {
      window.removeEventListener('subscription:required', handleSubscriptionRequired as EventListener);
      window.removeEventListener('subscription:inactive', handleSubscriptionInactive as EventListener);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);
  
  const handleClose = () => {
    setIsVisible(false);
    
    // Definir um timeout mais longo após o fechamento manual
    ignoreEventsTimeoutRef.current = true;
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    
    timeoutIdRef.current = setTimeout(() => {
      ignoreEventsTimeoutRef.current = false;
    }, 60000); // Ignorar novos eventos por 1 minuto após fechar manualmente
    
    if (onClose) onClose();
    
    // Armazenar no localStorage que o usuário fechou o modal
    try {
      localStorage.setItem('subscription_modal_closed', Date.now().toString());
    } catch (e) {
      console.error('[SubscriptionRequired] Erro ao salvar estado no localStorage:', e);
    }
  };
  
  const redirectToSubscription = () => {
    // Redirecionar para a página de assinatura
    window.location.href = '/subscription';
  };
  
  const retryConnection = async () => {
    setIsRetrying(true);
    
    try {
      // Tentar recarregar dados (esperar um pouco para dar tempo ao servidor)
      console.log('[SubscriptionRequired] Tentando reconexão...');
      
      // Forçar uma atualização de status de assinatura
      const apiServiceModule = await import('../services/apiService');
      const apiService = apiServiceModule.default;
      
      // Limpar os caches para forçar nova verificação
      localStorage.removeItem('api_subscription_cache');
      
      // Verificar status da assinatura
      await apiService.checkSubscriptionStatus();
      
      // Forçar atualização dos dados - usando EventService 
      const { default: EventService } = await import('../services/EventService');
      EventService.emit('roulette:force-update', { source: 'subscription-modal' });
      
      // Recarregar a página atual como último recurso após um breve atraso
      setTimeout(() => {
        setIsRetrying(false);
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('[SubscriptionRequired] Erro ao tentar reconexão:', error);
      setIsRetrying(false);
    }
  };
  
  // Determinar ações de solução baseadas no tipo de erro
  const getErrorSolution = () => {
    if (!errorDetails) return null;
    
    if (errorDetails.error === 'SUBSCRIPTION_REQUIRED') {
      return (
        <div className="mt-4 text-sm text-gray-600">
          <h4 className="font-medium mb-2">Soluções possíveis:</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Assine um plano compatível com esta funcionalidade</li>
            <li>Entre em contato com o suporte se acredita que sua assinatura deveria estar ativa</li>
          </ul>
        </div>
      );
    }
    
    if (errorDetails.error === 'NO_ACTIVE_SUBSCRIPTION') {
      return (
        <div className="mt-4 text-sm text-gray-600">
          <h4 className="font-medium mb-2">Soluções possíveis:</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Verifique se seu pagamento foi processado corretamente</li>
            <li>Confira se a assinatura não foi cancelada ou expirou</li>
            <li>Entre em contato com o suporte para verificar o status do pagamento</li>
          </ul>
        </div>
      );
    }
    
    if (errorDetails.error === 'SUBSCRIPTION_INACTIVE') {
      return (
        <div className="mt-4 text-sm text-gray-600">
          <h4 className="font-medium mb-2">Soluções possíveis:</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Sua assinatura está com status "{errorDetails.status || 'inativo'}"</li>
            <li>Verifique se houve algum problema com seu pagamento</li>
            <li>Acesse a área do assinante para realizar uma verificação da assinatura</li>
            <li>Entre em contato com o suporte indicando o código: <span className="font-mono bg-gray-200 px-1 rounded">{errorDetails.subscription?.id || 'N/A'}</span></li>
          </ul>
          {errorDetails.cacheAge && (
            <p className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Observação:</span> Você está vendo dados em cache com {errorDetails.cacheAge} minutos de idade.
              Para acessar dados em tempo real, é necessário ativar sua assinatura.
            </p>
          )}
        </div>
      );
    }
    
    return null;
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
              {errorDetails.userDetails?.subscriptionStatus && (
                <p><strong>Status da assinatura:</strong> {errorDetails.userDetails.subscriptionStatus}</p>
              )}
            </div>
          )}
          
          {/* Mostrar sugestões de solução baseadas no tipo de erro */}
          {getErrorSolution()}
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
          >
            Fechar
          </button>
          <button
            onClick={retryConnection}
            disabled={isRetrying}
            className={`px-4 py-2 border rounded ${isRetrying ? 'bg-gray-200 text-gray-500' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
          >
            {isRetrying ? 'Tentando...' : 'Tentar Novamente'}
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