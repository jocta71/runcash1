import React, { createContext, useContext, useState, useEffect } from 'react';
import LoginModal from '@/components/LoginModal';
import { useAuth } from './AuthContext';

type LoginModalContextType = {
  showLoginModal: () => void;
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
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setManuallyClosedByUser(false);
    }
  }, [user]);

  const showLoginModal = () => {
    if (!user && !manuallyClosedByUser) {
      setIsModalOpen(true);
    }
  };

  const hideLoginModal = () => {
    setIsModalOpen(false);
    setManuallyClosedByUser(true);
  };

  const resetModalClosed = () => {
    setManuallyClosedByUser(false);
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
      <LoginModal isOpen={isModalOpen} onClose={hideLoginModal} />
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => useContext(LoginModalContext); 