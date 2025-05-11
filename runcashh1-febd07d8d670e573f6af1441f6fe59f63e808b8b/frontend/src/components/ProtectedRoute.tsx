import React, { useEffect, useState, useCallback } from 'react';
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
  // Flag para evitar múltiplas verificações
  const [isVerifying, setIsVerifying] = useState(false);
  // Contador de tentativas de verificação
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  // Verificar state da location para mensagens de redirecionamento
  const locationState = location.state as { 
    message?: string; 
    redirectAfterLogin?: string;
    showLoginModal?: boolean;
    fromLogin?: boolean;
    fromSignup?: boolean;
  } | undefined;

  // Função de debug melhorada
  const logDebug = useCallback((message: string) => {
    console.log(`[ProtectedRoute] ${message}`);
  }, []);

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
    
    const newIsPaymentPage = isPaymentRelatedPath || hasPaymentParams;
    
    // Só atualizar e logar se o valor mudar
    if (newIsPaymentPage !== isPaymentPage) {
      setIsPaymentPage(newIsPaymentPage);
      
      // Debug
      if (newIsPaymentPage) {
        logDebug(`Página de pagamento detectada: ${path}${search}`);
      }
    }
  }, [location.pathname, location.search, isPaymentPage, logDebug]);

  // Efeito para verificar se há parâmetros no estado da navegação para mostrar modal de login
  useEffect(() => {
    // Se o usuário acabou de fazer login, não mostrar modal
    if (locationState?.fromLogin || locationState?.fromSignup) {
      logDebug('Ignorando verificação após login/signup bem-sucedido');
      setAuthChecked(true);
      setModalShown(true);
      return;
    }
    
    // Mostrar modal apenas se especificado no state e não tiver sido mostrado ainda
    if (locationState?.showLoginModal && !modalShown && !user) {
      logDebug('Mostrando modal de login a partir de estado de navegação');
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
  }, [locationState, modalShown, user, showLoginModal, logDebug]);

  // Função para verificar autenticação
  const verifyAuthentication = useCallback(async () => {
    if (isVerifying) {
      return;
    }
    
    try {
      setIsVerifying(true);
      logDebug('Iniciando verificação de autenticação');
      
      const isAuthenticated = await checkAuth();
      logDebug(`Status da autenticação: ${isAuthenticated ? 'Autenticado' : 'Não autenticado'}`);
      
      // Se a autenticação falhou mas temos token, tentar novamente até 3 vezes
      if (!isAuthenticated && token && verificationAttempts < 3) {
        logDebug(`Tentativa ${verificationAttempts + 1}/3: Token existe mas verificação falhou, agendando nova tentativa`);
        setVerificationAttempts(prev => prev + 1);
        
        // Agendar nova tentativa após um curto intervalo
        setTimeout(() => {
          setIsVerifying(false);
          // Próxima verificação será disparada pelo useEffect
        }, 1000);
        
        return;
      }
      
      setAuthChecked(true);
      setVerificationAttempts(0);
    } catch (error) {
      logDebug(`Erro durante verificação de autenticação: ${error}`);
      setAuthChecked(true);
      setVerificationAttempts(0);
    } finally {
      setIsVerifying(false);
    }
  }, [checkAuth, isVerifying, token, verificationAttempts, logDebug]);

  // Efeito para verificação inicial de autenticação
  useEffect(() => {
    // Se usuário já está autenticado em memória, evitar verificação adicional
    if (user) {
      logDebug(`Usuário já autenticado em memória: ${user.username || user.email}`);
      setAuthChecked(true);
      return;
    }
    
    // Se temos token mas não usuário, pode ser um reload de página - forçar verificação
    if (!user && token) {
      logDebug('Token disponível sem dados de usuário, possivelmente após reload');
    }
    
    // Evitar verificações repetidas se já estiver verificado e não for forçado
    if (!authChecked && !loading && !isVerifying && verificationAttempts < 3) {
      verifyAuthentication();
    }
  }, [user, authChecked, loading, token, isVerifying, verificationAttempts, verifyAuthentication, logDebug]);

  // Efeito separado para controlar a exibição do modal de login
  useEffect(() => {
    // Não mostrar modal se estamos verificando
    if (loading || isVerifying) {
      return;
    }
    
    // Não mostrar modal automaticamente se viemos de um login/cadastro bem-sucedido
    if (locationState?.fromLogin || locationState?.fromSignup) {
      logDebug('Pulando modal após login/signup bem-sucedido');
      return;
    }
    
    // Páginas críticas (pagamento) sempre verificam autenticação
    if (isPaymentPage && !user && !modalShown && authChecked) {
      logDebug('Página crítica de pagamento, verificando autenticação');
      
      logDebug('Mostrando modal para página de pagamento');
      showLoginModal({
        redirectAfterLogin: location.pathname + location.search,
        message: 'Por favor, faça login para continuar com o pagamento.'
      });
      setModalShown(true);
    }
    // Só mostrar o modal se autenticação for requerida, usuário não estiver logado
    // e o modal ainda não foi mostrado nesta sessão
    else if (requireAuth && !user && authChecked && !modalShown && !loading) {
      logDebug('Mostrando modal de login para rota protegida');
      
      // Combinar opções do componente com opções da location state
      const combinedOptions = {
        redirectAfterLogin: modalOptions?.redirectAfterLogin || locationState?.redirectAfterLogin || location.pathname,
        message: modalOptions?.message || locationState?.message || 'É necessário fazer login para acessar esta página.'
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
  }, [
    requireAuth, user, authChecked, modalShown, loading, showLoginModal, 
    modalOptions, locationState, location.pathname, location.search, 
    isPaymentPage, isVerifying, logDebug
  ]);

  // Mostrar tela de carregamento apenas durante a verificação inicial
  if ((loading || isVerifying) && !authChecked) {
    return <LoadingScreen />;
  }

  // Sempre mostrar o conteúdo da rota (o modal aparecerá sobre ele se necessário)
  return <>{children}</>;
};

export default ProtectedRoute;
