import React, { useEffect } from 'react';
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

  useEffect(() => {
    // Verificar autenticação quando o componente montar
    checkAuth();
  }, [checkAuth]);

  // Enquanto verifica autenticação, mostrar tela de carregamento
  if (loading) {
    return <LoadingScreen />;
  }

  // Se não estiver autenticado, redirecionar para login
  if (!user) {
    // Não adicionar redirecionamento para /test ou outras rotas específicas
    if (location.pathname === '/test') {
      return <Navigate to="/login" replace />;
    }
    
    // Para outras rotas, manter o comportamento normal
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se estiver autenticado, mostrar o conteúdo da rota
  return <>{children}</>;
};

export default ProtectedRoute;
