import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rotas, verificando se o usuário está autenticado
 * Se não estiver autenticado, abre o modal de autenticação
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, checkAuth, requireAuth } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Evitar verificações repetidas se já tiver um usuário ou já estiver verificado
    if (!user && !authChecked && !loading) {
      const verifyAuth = async () => {
        await checkAuth();
        setAuthChecked(true);
        
        // Se após a verificação ainda não estiver autenticado, mostra o modal
        if (!user) {
          requireAuth();
        }
      };
      
      verifyAuth();
    }
  }, [user, authChecked, loading, checkAuth, requireAuth]);

  // Mostrar tela de carregamento apenas durante a verificação inicial
  if (loading && !authChecked) {
    return <LoadingScreen />;
  }

  // Se não estiver autenticado, ainda renderiza o children, mas o modal de auth será exibido
  // pelo componente AuthModal no App.tsx
  return <>{children}</>;
};

export default ProtectedRoute;
