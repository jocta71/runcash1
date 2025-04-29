import React, { createContext, useContext, useState, useEffect } from 'react';
import LoginModal from '@/components/LoginModal';
import { useAuth } from './AuthContext';

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

export const LoginModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manuallyClosedByUser, setManuallyClosedByUser] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setManuallyClosedByUser(false);
      setRedirectAfterLogin(undefined);
      setMessage(undefined);
    }
  }, [user]);

  const showLoginModal = (options?: { redirectAfterLogin?: string; message?: string }) => {
    if (!user && !manuallyClosedByUser) {
      if (options?.redirectAfterLogin) {
        setRedirectAfterLogin(options.redirectAfterLogin);
      }
      
      if (options?.message) {
        setMessage(options.message);
      }
      
      setIsModalOpen(true);
    }
  };

  const hideLoginModal = () => {
    setIsModalOpen(false);
    setManuallyClosedByUser(true);
  };

  const resetModalClosed = () => {
    setManuallyClosedByUser(false);
    setRedirectAfterLogin(undefined);
    setMessage(undefined);
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
        redirectAfterLogin={redirectAfterLogin}
        message={message}
      />
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => useContext(LoginModalContext); 