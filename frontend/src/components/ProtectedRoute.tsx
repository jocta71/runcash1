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
  const { user, loading, checkAuth, token } = useAuth();
  const { showLoginModal } = useLoginModal();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  // Flag para controlar se o modal já foi mostrado
  const [modalShown, setModalShown] = useState(false);
  // Flag para identificar páginas de pagamento (que são críticas)
  const [isPaymentPage, setIsPaymentPage] = useState(false);

  // Verificar state da location para mensagens de redirecionamento
  const locationState = location.state as { 
    message?: string; 
    redirectAfterLogin?: string;
    showLoginModal?: boolean;
    fromLogin?: boolean;
    fromSignup?: boolean;
  } | undefined;

  // Verificar se a página atual está relacionada a pagamento
  useEffect(() => {
    const path = location.pathname;
    const search = location.search;
    
    const isPaymentRelatedPath = 
      path.includes('payment') || 
      path.includes('pagamento');
      
    const hasPaymentParams = 
      search.includes('planId') || 
      search.includes('paymentId') ||
      search.includes('customerId');
    
    setIsPaymentPage(isPaymentRelatedPath || hasPaymentParams);
  }, [location]);

  // Efeito para verificar se há parâmetros no estado da navegação para mostrar modal de login
  useEffect(() => {
    // Se o usuário acabou de fazer login, não mostrar modal
    if (locationState?.fromLogin || locationState?.fromSignup) {
      console.log('[ProtectedRoute] Ignorando verificação após login/signup bem-sucedido');
      setAuthChecked(true);
      setModalShown(true);
      return;
    }
    
    if (locationState?.showLoginModal && !modalShown && !user) {
      console.log('[ProtectedRoute] Mostrando modal de login a partir de estado de navegação');
      const options: Record<string, string> = {};
      
      if (locationState.redirectAfterLogin) {
        options.redirectAfterLogin = locationState.redirectAfterLogin;
      }
      
      if (locationState.message) {
        options.message = locationState.message;
      }
      
      if (Object.keys(options).length > 0) {
        showLoginModal(options);
      } else {
        showLoginModal();
      }
      
      setModalShown(true);
    }
  }, [locationState, modalShown, user, showLoginModal]);

  useEffect(() => {
    // Se usuário já está autenticado em memória, evitar verificação adicional
    if (user && token) {
      console.log('[ProtectedRoute] Usuário já autenticado em memória');
      setAuthChecked(true);
      return;
    }
    
    // Se temos token mas não usuário, pode ser um reload de página
    if (!user && token) {
      console.log('[ProtectedRoute] Token disponível sem dados de usuário, possivelmente após reload');
    }
    
    // Evitar verificações repetidas se já estiver verificado
    if (!authChecked && !loading) {
      console.log('[ProtectedRoute] Verificando autenticação inicial');
      const verifyAuth = async () => {
        try {
          const isAuthenticated = await checkAuth();
          console.log(`[ProtectedRoute] Status da autenticação: ${isAuthenticated ? 'Autenticado' : 'Não autenticado'}`);
          setAuthChecked(true);
        } catch (error) {
          console.error('[ProtectedRoute] Erro durante verificação de autenticação:', error);
          // Mesmo em caso de erro, considerar verificado para não ficar em loop
          setAuthChecked(true);
        }
      };
      
      verifyAuth();
    }
  }, [user, authChecked, loading, checkAuth, token]);

  // Efeito separado para controlar a exibição do modal de login
  useEffect(() => {
    // Páginas críticas (pagamento) sempre verificam autenticação
    if (isPaymentPage && !user && !modalShown) {
      console.log('[ProtectedRoute] Página crítica de pagamento, verificando autenticação');
      
      // Verificar novamente a autenticação para páginas críticas
      if (authChecked) {
        console.log('[ProtectedRoute] Mostrando modal para página de pagamento');
        showLoginModal({
          redirectAfterLogin: location.pathname + location.search,
          message: 'Por favor, faça login para continuar com o pagamento.'
        });
        setModalShown(true);
      }
    }
    // Só mostrar o modal se autenticação for requerida, usuário não estiver logado
    // e o modal ainda não foi mostrado nesta sessão
    else if (requireAuth && !user && authChecked && !modalShown && !loading) {
      // Não mostrar modal automaticamente se viemos de um login/cadastro bem-sucedido
      if (locationState?.fromLogin || locationState?.fromSignup) {
        console.log('[ProtectedRoute] Pulando modal após login/signup bem-sucedido');
        return;
      }
      
      console.log('[ProtectedRoute] Mostrando modal de login para rota protegida');
      
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
  }, [requireAuth, user, authChecked, modalShown, loading, showLoginModal, modalOptions, locationState, location.pathname, location.search, isPaymentPage]);

  // Mostrar tela de carregamento apenas durante a verificação inicial
  if (loading && !authChecked) {
    return <LoadingScreen />;
  }

  // Sempre mostrar o conteúdo da rota (o modal aparecerá sobre ele se necessário)
  return <>{children}</>;
};

export default ProtectedRoute;
