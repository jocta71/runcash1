import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';
import { useSessionExpiration } from '@/hooks/useSessionExpiration';
import { AUTH_MESSAGES } from '@/constants/auth-messages';
import LoadingScreen from './LoadingScreen';
import { useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // Se true, exige autenticação e mostra modal se não estiver autenticado
  modalOptions?: {
    redirectAfterLogin?: string;
    message?: string;
    context?: 'payment' | 'subscription' | 'account' | 'generic';
  };
}

/**
 * Componente que gerencia a proteção das rotas:
 * - Se requireAuth=true: Mostra o conteúdo apenas para usuários autenticados, caso contrário mostra modal de login
 * - Se requireAuth=false: Sempre mostra o conteúdo (usado para páginas públicas)
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAuth = true,
  modalOptions 
}) => {
  const { user, loading, checkAuth } = useAuth();
  const { showLoginModal } = useLoginModal();
  const { handleSessionExpired } = useSessionExpiration();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  // Flag para controlar se o modal já foi mostrado
  const [modalShown, setModalShown] = useState(false);

  // Verificar state da location para mensagens de redirecionamento
  const locationState = location.state as { 
    message?: string; 
    redirectAfterLogin?: string;
    showLoginModal?: boolean;
    context?: 'payment' | 'subscription' | 'account' | 'generic';
  } | undefined;

  // Efeito para verificar se há parâmetros no estado da navegação para mostrar modal de login
  useEffect(() => {
    if (locationState?.showLoginModal && !modalShown && !user) {
      console.log('[ProtectedRoute] Mostrando modal de login a partir de estado de navegação');
      
      if (locationState.redirectAfterLogin) {
        const context = locationState.context || 'generic';
        const message = locationState.message || AUTH_MESSAGES.SESSION_EXPIRED;
        
        handleSessionExpired(locationState.redirectAfterLogin, context);
      } else {
        handleSessionExpired();
      }
      
      setModalShown(true);
    }
  }, [locationState, modalShown, user, handleSessionExpired]);

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

  // Efeito separado para controlar a exibição do modal de login
  useEffect(() => {
    // Só mostrar o modal se autenticação for requerida, usuário não estiver logado
    // e o modal ainda não foi mostrado nesta sessão
    if (requireAuth && !user && authChecked && !modalShown && !loading) {
      // Determinar o contexto da expiração de sessão
      const context = modalOptions?.context || locationState?.context || 'generic';
      const redirectPath = modalOptions?.redirectAfterLogin || locationState?.redirectAfterLogin || location.pathname;
      
      // Usar o hook para mostrar o modal com as mensagens adequadas
      handleSessionExpired(redirectPath, context);
      setModalShown(true);
    }
    
    // Resetar o flag quando o usuário mudar
    if (user) {
      setModalShown(false);
    }
  }, [requireAuth, user, authChecked, modalShown, loading, handleSessionExpired, modalOptions, locationState, location.pathname]);

  // Mostrar tela de carregamento apenas durante a verificação inicial
  if (loading && !authChecked) {
    return <LoadingScreen />;
  }

  // Sempre mostrar o conteúdo da rota (o modal aparecerá sobre ele se necessário)
  return <>{children}</>;
};

export default ProtectedRoute;
