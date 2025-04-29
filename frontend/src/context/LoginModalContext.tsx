import React, { createContext, useContext, useState, useEffect } from 'react';
import LoginModal from '@/components/LoginModal';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

type LoginModalContextType = {
  showLoginModal: (options?: { redirectAfterLogin?: string; message?: string }) => void;
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
  
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Fechar o modal automaticamente quando o usuário estiver autenticado
  useEffect(() => {
    if (user && isModalOpen) {
      setIsModalOpen(false);
      
      // Se temos um caminho de redirecionamento, navegar para ele
      if (redirectPath) {
        navigate(redirectPath);
        setRedirectPath(undefined);
      }
    }
  }, [user, isModalOpen, redirectPath, navigate]);
  
  // Função para mostrar o modal
  const showLoginModal = (options?: { redirectAfterLogin?: string; message?: string }) => {
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
    
    setIsModalOpen(true);
  };

  // Listener para eventos de "login necessário"
  useEffect(() => {
    const handleLoginRequired = (event: CustomEvent) => {
      console.log('[LoginModal] Evento auth:login_required recebido:', event);
      
      if (event.detail) {
        // Extrair detalhes do evento
        const { message, redirectAfterLogin } = event.detail;
        
        // Mostrar o modal com as opções do evento
        showLoginModal({
          message: message || 'É necessário fazer login para continuar',
          redirectAfterLogin: redirectAfterLogin || window.location.pathname
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
  }, [showLoginModal]);

  const hideLoginModal = () => {
    setIsModalOpen(false);
  };

  const resetModalClosed = () => {
    setRedirectPath(undefined);
    setModalMessage(undefined);
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
      />
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => useContext(LoginModalContext); 