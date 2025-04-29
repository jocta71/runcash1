import React, { createContext, useContext, useState, useEffect } from 'react';
import LoginModal from '@/components/LoginModal';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

type LoginModalContextType = {
  showLoginModal: (options?: { redirectAfterLogin?: string; message?: string; requiresSubscription?: boolean }) => void;
  hideLoginModal: () => void;
  isModalOpen: boolean;
  resetModalClosed: () => void;
  isSubscriptionRequired: boolean;
};

const LoginModalContext = createContext<LoginModalContextType>({
  showLoginModal: () => {},
  hideLoginModal: () => {},
  isModalOpen: false,
  resetModalClosed: () => {},
  isSubscriptionRequired: false,
});

/**
 * Provedor do contexto de modal de login
 * Gerencia a lógica de exibição do modal de login em toda a aplicação
 */
export const LoginModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | undefined>(undefined);
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);
  const [isSubscriptionRequired, setIsSubscriptionRequired] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Função para mostrar o modal
  const showLoginModal = (options?: { 
    redirectAfterLogin?: string; 
    message?: string; 
    requiresSubscription?: boolean 
  }) => {
    // Armazenar o caminho de redirecionamento, se fornecido
    if (options?.redirectAfterLogin) {
      setRedirectPath(options.redirectAfterLogin);
    }
    
    // Armazenar a mensagem personalizada, se fornecida
    if (options?.message) {
      setModalMessage(options.message);
    } else {
      setModalMessage(undefined); // Usar a mensagem padrão
    }
    
    // Definir se requer assinatura
    setIsSubscriptionRequired(!!options?.requiresSubscription);
    
    setIsModalOpen(true);
  };
  
  // Fechar o modal automaticamente quando o usuário estiver autenticado
  useEffect(() => {
    if (user && isModalOpen) {
      // Se requer assinatura, verificar se o usuário tem assinatura
      if (isSubscriptionRequired) {
        // Verificar se o usuário tem um plano ativo baseado nos dados do usuário
        const hasActivePlan = !!(
          user.subscription?.active || 
          user.subscription?.status === 'active' || 
          user.plan?.active || 
          user.hasPaidPlan || 
          user.isSubscribed ||
          user.isAdmin // Permitir acesso para administradores
        );
        
        // Se não tem plano, manter o modal aberto com a mensagem sobre assinatura
        if (!hasActivePlan) {
          console.log('[LoginModal] Usuário logado, mas sem plano ativo');
          setModalMessage('Você precisa de uma assinatura para acessar este conteúdo.');
          return;
        }
      }
      
      // Se chegou aqui, o usuário está autenticado e tem assinatura (ou não é necessária)
      setIsModalOpen(false);
      
      // Se temos um caminho de redirecionamento, navegar para ele
      if (redirectPath) {
        navigate(redirectPath);
        setRedirectPath(undefined);
      }
    }
  }, [user, isModalOpen, redirectPath, navigate, isSubscriptionRequired]);

  // Listener para eventos de "login necessário"
  useEffect(() => {
    const handleLoginRequired = (event: CustomEvent) => {
      console.log('[LoginModal] Evento auth:login_required recebido:', event);
      
      if (event.detail) {
        // Extrair detalhes do evento
        const { message, redirectAfterLogin, requiresSubscription } = event.detail;
        
        // Mostrar o modal com as opções do evento
        showLoginModal({
          message: message || 'É necessário fazer login para continuar',
          redirectAfterLogin: redirectAfterLogin || window.location.pathname,
          requiresSubscription: !!requiresSubscription
        });
      } else {
        // Caso o evento não tenha detalhes, mostrar o modal com mensagem padrão
        showLoginModal();
      }
    };
    
    // Registrar o listener
    document.addEventListener('auth:login_required', handleLoginRequired as EventListener);
    
    // Remover o listener ao desmontar
    return () => {
      document.removeEventListener('auth:login_required', handleLoginRequired as EventListener);
    };
  }, []);
  
  // Listener para eventos de "assinatura necessária"
  useEffect(() => {
    const handleSubscriptionRequired = (event: CustomEvent) => {
      console.log('[LoginModal] Evento subscription:required recebido:', event);
      
      if (event.detail) {
        // Extrair detalhes do evento
        const { message, redirectAfterLogin } = event.detail;
        
        // Mostrar o modal com as opções do evento
        showLoginModal({
          message: message || 'É necessária uma assinatura para acessar este conteúdo',
          redirectAfterLogin: redirectAfterLogin || window.location.pathname,
          requiresSubscription: true
        });
      } else {
        // Caso o evento não tenha detalhes, mostrar o modal com mensagem padrão
        showLoginModal({
          requiresSubscription: true,
          message: 'É necessária uma assinatura para acessar este conteúdo'
        });
      }
    };
    
    // Registrar o listener
    document.addEventListener('subscription:required', handleSubscriptionRequired as EventListener);
    
    // Remover o listener ao desmontar
    return () => {
      document.removeEventListener('subscription:required', handleSubscriptionRequired as EventListener);
    };
  }, []);

  const hideLoginModal = () => {
    setIsModalOpen(false);
  };

  const resetModalClosed = () => {
    setRedirectPath(undefined);
    setModalMessage(undefined);
    setIsSubscriptionRequired(false);
  };

  return (
    <LoginModalContext.Provider
      value={{
        showLoginModal,
        hideLoginModal,
        isModalOpen,
        resetModalClosed,
        isSubscriptionRequired,
      }}
    >
      {children}
      <LoginModal 
        isOpen={isModalOpen} 
        onClose={hideLoginModal} 
        redirectAfterLogin={redirectPath}
        message={modalMessage}
        requiresSubscription={isSubscriptionRequired}
      />
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => useContext(LoginModalContext); 