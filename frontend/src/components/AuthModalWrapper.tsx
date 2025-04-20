import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuthModal } from '@/context/AuthModalContext';
import AuthModal from './ui/AuthModal';

// Este componente será usado no layout principal da aplicação
// para mostrar o modal de autenticação quando necessário
const AuthModalWrapper = () => {
  const { isAuthModalOpen, activeTab, closeAuthModal } = useAuthModal();
  const { user } = useAuth();
  
  // Fechar o modal automaticamente se o usuário estiver autenticado
  useEffect(() => {
    if (user && isAuthModalOpen) {
      closeAuthModal();
    }
  }, [user, isAuthModalOpen, closeAuthModal]);
  
  return (
    <AuthModal 
      isOpen={isAuthModalOpen} 
      onClose={closeAuthModal} 
      defaultTab={activeTab}
    />
  );
};

export default AuthModalWrapper; 