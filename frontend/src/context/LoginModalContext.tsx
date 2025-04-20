import React, { createContext, useContext, useState } from 'react';
import LoginModal from '@/components/LoginModal';
import { useAuth } from './AuthContext';

type LoginModalContextType = {
  showLoginModal: () => void;
  hideLoginModal: () => void;
  isModalOpen: boolean;
};

const LoginModalContext = createContext<LoginModalContextType>({
  showLoginModal: () => {},
  hideLoginModal: () => {},
  isModalOpen: false,
});

export const LoginModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();

  const showLoginModal = () => {
    if (!user) {
      setIsModalOpen(true);
    }
  };

  const hideLoginModal = () => {
    setIsModalOpen(false);
  };

  return (
    <LoginModalContext.Provider
      value={{
        showLoginModal,
        hideLoginModal,
        isModalOpen,
      }}
    >
      {children}
      <LoginModal isOpen={isModalOpen} onClose={hideLoginModal} />
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => useContext(LoginModalContext); 