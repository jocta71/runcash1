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
  const [pollingPaused, setPollingPaused] = useState(false);
  
  // Referências para controle de exibição do modal
  const lastShownTime = useRef<number>(0);
  const modalClosedByUser = useRef<boolean>(false);
  const debounceTimer = useRef<any>(null);
  const ignoreEvents = useRef<boolean>(false);
  
  useEffect(() => {
    // Verificar se o modal foi fechado anteriormente nesta sessão
    const modalAlreadyClosed = localStorage.getItem('subscription_modal_closed');
    if (modalAlreadyClosed === 'true') {
      modalClosedByUser.current = true;
      const lastShown = localStorage.getItem('subscription_modal_last_shown');
      if (lastShown) {
        lastShownTime.current = parseInt(lastShown, 10);
      }
    }
    
    // Verificar se o polling está pausado
    const pollingStatus = localStorage.getItem('roulette_polling_paused');
    if (pollingStatus === 'true') {
      setPollingPaused(true);
    }
    
    // Registrar listener para eventos de assinatura requerida
    const handleSubscriptionRequired = (event: CustomEvent<any>) => {
      console.log('[SubscriptionRequired] Evento subscription:required recebido:', event.detail);
      
      // Ignorar eventos se estiver configurado para ignorá-los
      if (ignoreEvents.current) {
        console.log('[SubscriptionRequired] Ignorando evento, flag de ignorar está ativo');
        return;
      }
      
      // Limpar timer de debounce anterior
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Usar debounce para evitar múltiplas exibições em sequência
      debounceTimer.current = setTimeout(() => {
        // Verificar se o modal já está visível
        if (isVisible) {
          return;
        }
        
        // Verificar se o polling está pausado
        if (pollingPaused) {
          console.log('[SubscriptionRequired] Polling está pausado, não exibindo modal');
          return;
        }
        
        // Verificar se o modal foi fechado pelo usuário e não permitir que apareça novamente
        // a menos que tenha se passado pelo menos 15 minutos desde o último fechamento
        const currentTime = Date.now();
        if (modalClosedByUser.current && currentTime - lastShownTime.current < 15 * 60 * 1000) {
          console.log('[SubscriptionRequired] Modal não será exibido novamente tão cedo, usuário fechou recentemente');
          return;
        }
        
        // Atualizar o tempo de última exibição
        lastShownTime.current = currentTime;
        localStorage.setItem('subscription_modal_last_shown', currentTime.toString());
        
        // Resetar o flag de fechamento
        modalClosedByUser.current = false;
        
        // Exibir o modal e armazenar detalhes
        setIsVisible(true);
        if (event.detail) {
          setErrorDetails({
            ...event.detail,
            errorType: 'required'
          });
        }
      }, 1000); // Aguardar 1 segundo para evitar múltiplas exibições
    };
    
    // Registrar listener para eventos de assinatura inativa
    const handleSubscriptionInactive = (event: CustomEvent<any>) => {
      console.log('[SubscriptionRequired] Evento subscription:inactive recebido:', event.detail);
      
      // Ignorar eventos se estiver configurado para ignorá-los
      if (ignoreEvents.current) {
        console.log('[SubscriptionRequired] Ignorando evento, flag de ignorar está ativo');
        return;
      }
      
      // Limpar timer de debounce anterior
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      // Usar debounce para evitar múltiplas exibições em sequência
      debounceTimer.current = setTimeout(() => {
        // Verificar se o modal já está visível
        if (isVisible) {
          return;
        }
        
        // Verificar se o polling está pausado
        if (pollingPaused) {
          console.log('[SubscriptionRequired] Polling está pausado, não exibindo modal');
          return;
        }
        
        // Verificar se o modal foi fechado pelo usuário e não permitir que apareça novamente
        // a menos que tenha se passado pelo menos 15 minutos desde o último fechamento
        const currentTime = Date.now();
        if (modalClosedByUser.current && currentTime - lastShownTime.current < 15 * 60 * 1000) {
          console.log('[SubscriptionRequired] Modal não será exibido novamente tão cedo, usuário fechou recentemente');
          return;
        }
        
        // Atualizar o tempo de última exibição
        lastShownTime.current = currentTime;
        localStorage.setItem('subscription_modal_last_shown', currentTime.toString());
        
        // Resetar o flag de fechamento
        modalClosedByUser.current = false;
        
        // Exibir o modal e armazenar detalhes
        setIsVisible(true);
        if (event.detail) {
          setErrorDetails({
            ...event.detail,
            error: 'SUBSCRIPTION_INACTIVE',
            message: event.detail.message || 'Sua assinatura existe mas não está ativa. Verifique o status do pagamento.',
            errorType: 'inactive'
          });
        }
      }, 1000); // Aguardar 1 segundo para evitar múltiplas exibições
    };
    
    window.addEventListener('subscription:required', handleSubscriptionRequired as EventListener);
    window.addEventListener('subscription:inactive', handleSubscriptionInactive as EventListener);
    
    return () => {
      window.removeEventListener('subscription:required', handleSubscriptionRequired as EventListener);
      window.removeEventListener('subscription:inactive', handleSubscriptionInactive as EventListener);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [isVisible, pollingPaused]);
  
  const handleClose = () => {
    setIsVisible(false);
    // Marcar que o modal foi fechado pelo usuário
    modalClosedByUser.current = true;
    lastShownTime.current = Date.now();
    
    // Armazenar na localStorage que o modal foi fechado
    localStorage.setItem('subscription_modal_closed', 'true');
    localStorage.setItem('subscription_modal_last_shown', Date.now().toString());
    
    // Pausar o polling e marcar como pausado
    pausePolling();
    
    if (onClose) onClose();
  };
  
  // Função para pausar o polling do GlobalRouletteService
  const pausePolling = () => {
    try {
      const event = new CustomEvent('roulette:pause-polling', {
        detail: { reason: 'subscription-modal-closed' }
      });
      window.dispatchEvent(event);
      console.log('[SubscriptionRequired] Solicitado pausa no polling para evitar eventos repetidos');
      
      // Atualizar estado local
      setPollingPaused(true);
      localStorage.setItem('roulette_polling_paused', 'true');
      
      // Ativar flag para ignorar eventos por um breve período
      ignoreEvents.current = true;
      setTimeout(() => {
        ignoreEvents.current = false;
      }, 3000);
    } catch (e) {
      console.error('[SubscriptionRequired] Erro ao pausar polling:', e);
    }
  };
  
  // Função para retomar o polling manualmente
  const resumePolling = async () => {
    try {
      console.log('[SubscriptionRequired] Retomando polling manualmente');
      
      // Importar o serviço dinâmicamente para evitar dependência circular
      const { default: globalRouletteDataService } = await import('../services/GlobalRouletteDataService');
      
      // Chamar o método para retomar o polling
      globalRouletteDataService.resumePollingManually();
      
      // Atualizar estado local
      setPollingPaused(false);
      localStorage.removeItem('roulette_polling_paused');
      
      // Notificar usuário
      alert('Polling de dados de roletas reativado com sucesso!');
    } catch (e) {
      console.error('[SubscriptionRequired] Erro ao retomar polling:', e);
      alert('Erro ao retomar polling. Por favor, recarregue a página.');
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
      
      // Remover flags de pausas
      localStorage.removeItem('roulette_polling_paused');
      setPollingPaused(false);
      
      // Verificar status da assinatura
      await apiService.checkSubscriptionStatus();
      
      // Forçar atualização dos dados - usando EventService 
      const { default: EventService } = await import('../services/EventService');
      EventService.emit('roulette:force-update', { source: 'subscription-modal' });
      
      // Retomar polling
      const { default: globalRouletteDataService } = await import('../services/GlobalRouletteDataService');
      globalRouletteDataService.resumePollingManually();
      
      // Fechar o modal
      setIsVisible(false);
      
      // Reset do estado de retry
      setTimeout(() => {
        setIsRetrying(false);
      }, 1000);
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
  
  if (!isVisible) {
    // Se o modal não estiver visível, mas o polling estiver pausado,
    // mostrar um pequeno indicador para permitir retomar o polling
    if (pollingPaused) {
      return (
        <div className="fixed bottom-4 right-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full shadow-md flex items-center space-x-2 cursor-pointer z-50" onClick={resumePolling}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          <span>Retomar atualizações</span>
        </div>
      );
    }
    return null;
  }
  
  // Determinar a mensagem a ser exibida
  const displayMessage = errorDetails?.message || message;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Assinatura Necessária</h3>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-gray-500"
            aria-label="Fechar"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-gray-700">{displayMessage}</p>
            </div>
          </div>
          
          {getErrorSolution()}
          
          {/* Informação sobre pausa no polling */}
          <div className="mt-4 text-xs text-gray-500 bg-gray-100 p-2 rounded">
            <p>O sistema de atualização automática será pausado após fechar esta mensagem para evitar interrupções contínuas. Use o botão "Retomar Atualizações" que aparecerá no canto inferior direito se quiser ativar novamente.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
          >
            Fechar
          </button>
          
          <button
            onClick={retryConnection}
            disabled={isRetrying}
            className={`px-4 py-2 text-white rounded transition-colors ${isRetrying ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} flex items-center justify-center`}
          >
            {isRetrying ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verificando...
              </>
            ) : (
              'Tentar Novamente'
            )}
          </button>
          
          <button
            onClick={redirectToSubscription}
            className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
          >
            Ver Planos
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionRequired; 