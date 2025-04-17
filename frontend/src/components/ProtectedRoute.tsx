import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rotas, verificando se o usuário está autenticado
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, checkAuth } = useAuth();
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

  // Se não estiver autenticado, redirecionar para login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se estiver autenticado, mostrar o conteúdo da rota
  return <>{children}</>;
};

export default ProtectedRoute;
