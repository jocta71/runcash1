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
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      // Verificar autenticação quando o componente montar
      await checkAuth();
      setIsVerifying(false);
    };
    
    verifyAuth();
  }, [checkAuth]);

  // Enquanto verifica autenticação, mostrar tela de carregamento
  if (loading || isVerifying) {
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
