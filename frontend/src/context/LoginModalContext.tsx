import React, { createContext, useContext, useState, useEffect } from 'react';
import LoginModal from '@/components/LoginModal';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import EventService from '@/services/EventService';

type LoginModalContextType = {
  showLoginModal: (options?: { redirectAfterLogin?: string; message?: string; showUpgradeOption?: boolean }) => void;
  hideLoginModal: () => void;
  isModalOpen: boolean;
  resetModalClosed: () => void;
};

const LoginModalContext = createContext<LoginModalContextType>({
  showLoginModal: () => {},
  hideLoginModal: () => {},
  isModalOpen: false,
  resetModalClosed: () => {},
});

/**
 * Provedor do contexto de modal de login
 * Gerencia a lógica de exibição do modal de login em toda a aplicação
 */
export const LoginModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | undefined>(undefined);
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);
  const [showUpgradeOption, setShowUpgradeOption] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Função para mostrar o modal
  const showLoginModal = (options?: { redirectAfterLogin?: string; message?: string; showUpgradeOption?: boolean }) => {
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
    
    // Armazenar a opção de mostrar upgrade
    setShowUpgradeOption(options?.showUpgradeOption || false);
    
    setIsModalOpen(true);
  };
  
  // Fechar o modal automaticamente quando o usuário estiver autenticado
  useEffect(() => {
    if (user && isModalOpen && !showUpgradeOption) {
      setIsModalOpen(false);
      
      // Se temos um caminho de redirecionamento, navegar para ele
      if (redirectPath) {
        navigate(redirectPath);
        setRedirectPath(undefined);
      }
    }
  }, [user, isModalOpen, redirectPath, navigate, showUpgradeOption]);

  // Listener para eventos de "login necessário"
  useEffect(() => {
    const handleLoginRequired = (event: CustomEvent) => {
      console.log('[LoginModal] Evento auth:login_required recebido:', event);
      
      if (event.detail) {
        // Extrair detalhes do evento
        const { message, redirectAfterLogin, requiresUpgrade } = event.detail;
        
        // Verificar se é necessário upgrade
        const needsUpgrade = requiresUpgrade === true;
        
        // Mostrar o modal com as opções do evento
        showLoginModal({
          message: message || (needsUpgrade 
            ? 'É necessário ter um plano para acessar esta funcionalidade' 
            : 'É necessário fazer login para continuar'),
          redirectAfterLogin: redirectAfterLogin || window.location.pathname,
          showUpgradeOption: needsUpgrade
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
    const handleSubscriptionRequired = (event: any) => {
      console.log('[LoginModal] Evento subscription:required recebido:', event);
      
      // Mostrar o modal de login com opção de upgrade
      showLoginModal({
        message: event.message || 'É necessário ter um plano para acessar esta funcionalidade',
        redirectAfterLogin: '/plans', // Redirecionar para página de planos
        showUpgradeOption: true
      });
    };
    
    // Registrar o listener
    EventService.on('subscription:required', handleSubscriptionRequired);
    
    // Remover o listener ao desmontar
    return () => {
      EventService.off('subscription:required', handleSubscriptionRequired);
    };
  }, []);

  const hideLoginModal = () => {
    setIsModalOpen(false);
  };

  const resetModalClosed = () => {
    setRedirectPath(undefined);
    setModalMessage(undefined);
    setShowUpgradeOption(false);
  };

  return (
    <LoginModalContext.Provider
      value={{
        showLoginModal,
        hideLoginModal,
        isModalOpen,
        resetModalClosed,
      }}
    >
      {children}
      <LoginModal 
        isOpen={isModalOpen} 
        onClose={hideLoginModal} 
        redirectAfterLogin={redirectPath}
        message={modalMessage}
        showUpgradeOption={showUpgradeOption}
      />
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => useContext(LoginModalContext); 