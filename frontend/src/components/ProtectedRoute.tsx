import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';
import LoadingScreen from './LoadingScreen';
import { useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // Se true, exige autenticação e mostra modal se não estiver autenticado
  modalOptions?: {
    redirectAfterLogin?: string;
    message?: string;
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
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  // Flag para controlar se o modal já foi mostrado
  const [modalShown, setModalShown] = useState(false);

  // Verificar state da location para mensagens de redirecionamento
  const locationState = location.state as { 
    message?: string; 
    redirectAfterLogin?: string;
  } | undefined;

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
      // Combinar opções do componente com opções da location state
      const combinedOptions = {
        redirectAfterLogin: modalOptions?.redirectAfterLogin || locationState?.redirectAfterLogin || location.pathname,
        message: modalOptions?.message || locationState?.message
      };
      
      // Só incluir mensagem e redirecionamento se realmente existirem
      const loginOptions: Record<string, string> = {};
      if (combinedOptions.redirectAfterLogin) {
        loginOptions.redirectAfterLogin = combinedOptions.redirectAfterLogin;
      }
      if (combinedOptions.message) {
        loginOptions.message = combinedOptions.message;
      }
      
      showLoginModal(Object.keys(loginOptions).length > 0 ? loginOptions : undefined);
      setModalShown(true);
    }
    
    // Resetar o flag quando o usuário mudar
    if (user) {
      setModalShown(false);
    }
  }, [requireAuth, user, authChecked, modalShown, loading, showLoginModal, modalOptions, locationState, location.pathname]);

  // Mostrar tela de carregamento apenas durante a verificação inicial
  if (loading && !authChecked) {
    return <LoadingScreen />;
  }

  // Sempre mostrar o conteúdo da rota (o modal aparecerá sobre ele se necessário)
  return <>{children}</>;
};

export default ProtectedRoute;
