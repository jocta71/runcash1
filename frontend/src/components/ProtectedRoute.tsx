import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import LoadingScreen from './LoadingScreen';
import { markPerformance } from '../utils/performance-optimizer';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que protege rotas, verificando se o usuário está autenticado
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, checkAuth, isAuthenticated } = useAuth();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Marcar para análise de performance
  markPerformance(`protected_route_mount_${location.pathname}`);

  useEffect(() => {
    const verifyAuth = async () => {
      console.log('ProtectedRoute: Verificando autenticação para:', location.pathname);
      
      // Se já temos um usuário ou estamos autenticados, podemos pular a verificação
      if (user || isAuthenticated) {
        console.log('ProtectedRoute: Já autenticado, pulando verificação');
        setIsVerifying(false);
        setAuthChecked(true);
        markPerformance(`protected_route_already_auth_${location.pathname}`);
        return;
      }
      
      try {
        // Verificar autenticação quando o componente montar
        markPerformance(`protected_route_check_auth_start_${location.pathname}`);
        const isAuth = await checkAuth();
        markPerformance(`protected_route_check_auth_end_${location.pathname}`);
        
        console.log('ProtectedRoute: Resultado da verificação:', isAuth);
        setAuthChecked(true);
      } catch (error) {
        console.error('ProtectedRoute: Erro ao verificar autenticação:', error);
      } finally {
        setIsVerifying(false);
      }
    };
    
    verifyAuth();
  }, [checkAuth, location.pathname, user, isAuthenticated]);

  // Enquanto verifica autenticação, mostrar tela de carregamento
  if (loading || isVerifying) {
    return <LoadingScreen message="Verificando autenticação..." />;
  }

  // Se não estiver autenticado, redirecionar para login
  if (!user && authChecked) {
    console.log('ProtectedRoute: Redirecionando para login de', location.pathname);
    markPerformance(`protected_route_redirect_to_login_${location.pathname}`);
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Se estiver autenticado, mostrar o conteúdo da rota
  console.log('ProtectedRoute: Renderizando conteúdo protegido para', location.pathname);
  markPerformance(`protected_route_render_content_${location.pathname}`);
  return <>{children}</>;
};

export default ProtectedRoute;
