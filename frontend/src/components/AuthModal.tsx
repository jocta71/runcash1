import { useAuth } from '@/context/AuthContext';
import AuthPage from '@/pages/AuthPage';

/**
 * Componente que renderiza o modal de autenticação
 * quando o estado showAuthModal no contexto de autenticação está ativo
 */
const AuthModal = () => {
  const { showAuthModal, closeAuthModal } = useAuth();
  
  // Renderiza o componente AuthPage com as props necessárias apenas se showAuthModal for true
  return showAuthModal ? (
    <AuthPage 
      isOpen={showAuthModal} 
      onClose={closeAuthModal} 
    />
  ) : null;
};

export default AuthModal; 