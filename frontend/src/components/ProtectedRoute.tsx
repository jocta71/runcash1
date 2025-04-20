import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAuthModal } from '@/context/AuthModalContext';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rotas, verificando se o usuário está autenticado
 * Em vez de redirecionar, abre o modal de autenticação
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, checkAuth } = useAuth();
  const { openAuthModal } = useAuthModal();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Evitar verificações repetidas se já tiver um usuário ou já estiver verificado
    if (!user && !authChecked && !loading) {
      const verifyAuth = async () => {
        await checkAuth();
        setAuthChecked(true);
      };
      
      verifyAuth();
    }
  }, [user, authChecked, loading, checkAuth]);

  // Mostrar tela de carregamento apenas durante a verificação inicial
  if (loading && !authChecked) {
    return <LoadingScreen />;
  }

  // Se não estiver autenticado, abrir o modal de login
  useEffect(() => {
    if (!user && authChecked) {
      // Armazenar a rota atual para redirecionamento após o login
      sessionStorage.setItem('authRedirectUrl', location.pathname);
      openAuthModal('login');
    }
  }, [user, authChecked, location, openAuthModal]);

  // Se estiver autenticado, mostrar o conteúdo da rota protegida
  // Se não estiver autenticado, mostrar conteúdo vazio (modal será aberto via efeito)
  return <>{user ? children : null}</>;
};

export default ProtectedRoute;
