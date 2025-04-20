import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // Se true, exige autenticação e mostra modal se não estiver autenticado
}

/**
 * Componente que gerencia a proteção das rotas:
 * - Se requireAuth=true: Mostra o conteúdo apenas para usuários autenticados, caso contrário mostra modal de login
 * - Se requireAuth=false: Sempre mostra o conteúdo (usado para páginas públicas)
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAuth = true }) => {
  const { user, loading, checkAuth } = useAuth();
  const { showLoginModal } = useLoginModal();
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

  // Se a autenticação for requerida e o usuário não estiver logado, mostrar o modal de login
  if (requireAuth && !user) {
    // Mostrar modal de login (sem redirecionar)
    showLoginModal();
  }

  // Sempre mostrar o conteúdo da rota (o modal aparecerá sobre ele se necessário)
  return <>{children}</>;
};

export default ProtectedRoute;
