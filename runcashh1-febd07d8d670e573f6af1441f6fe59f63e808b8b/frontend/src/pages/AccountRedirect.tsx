import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';

/**
 * Componente de redirecionamento para a rota /account
 * Esta página serve como um intermediário após confirmação de pagamento
 * Redireciona automaticamente para a página de assinatura
 */
const AccountRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, checkAuth, setUser } = useAuth();
  const { loadUserSubscription } = useSubscription();
  const { showLoginModal } = useLoginModal();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Processando pagamento...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showedLoginModal, setShowedLoginModal] = useState(false);
  
  // Verificar se temos um userId na URL
  const queryParams = new URLSearchParams(location.search);
  const userIdFromUrl = queryParams.get('userId');
  const sessionIdFromUrl = queryParams.get('session_id');

  // Função para mostrar modal de login em vez de redirecionar para página de login
  const handleShowLoginModal = (redirectPath = '/billing', message = 'Por favor, faça login para acessar sua assinatura.') => {
    // Mostrar o modal diretamente
    showLoginModal({
      redirectAfterLogin: redirectPath,
      message: message
    });
    setShowedLoginModal(true);
  };

  // Efeito para verificar autenticação e mostrar login modal
  useEffect(() => {
    if (!showedLoginModal) {
      const verifyAuth = async () => {
        console.log('[AccountRedirect] Verificando autenticação...');
        setLoadingMessage('Verificando sua conta...');
        
        try {
          // Forçar verificação de autenticação
          const isAuthenticated = await checkAuth();
          setAuthChecked(true);
          
          if (!isAuthenticated) {
            console.log('[AccountRedirect] Usuário não autenticado, mostrando modal de login');
            setHasError(true);
            setLoadingMessage('Por favor, faça login para continuar.');
            handleShowLoginModal('/billing');
          } else {
            console.log('[AccountRedirect] Verificação de autenticação bem-sucedida.');
            // Continuar com o carregamento normal
          }
        } catch (error) {
          console.error('[AccountRedirect] Erro ao verificar autenticação:', error);
          setHasError(true);
          setLoadingMessage('Por favor, faça login para continuar.');
          handleShowLoginModal();
        }
      };
      
      // Verificar autenticação apenas se o carregamento inicial já terminou
      if (!authLoading) {
        verifyAuth();
      }
    }
  }, [authLoading, showLoginModal, checkAuth, showedLoginModal]);

  // Segundo efeito: carregar assinatura e redirecionar
  useEffect(() => {
    // Só prosseguir se a autenticação já foi verificada e o usuário existe
    if (authChecked && user && user.id) {
      const loadSubscriptionAndRedirect = async () => {
        try {
          console.log('[AccountRedirect] Usuário autenticado:', user.id);
          setLoadingMessage('Atualizando dados da assinatura...');
          
          // Verificar se temos informações na URL relevantes para depuração
          if (sessionIdFromUrl) {
            console.log(`[AccountRedirect] Session ID da URL: ${sessionIdFromUrl}`);
          }
          
          // Tentar carregar os dados da assinatura várias vezes
          // para garantir que a API tenha tempo de registrar a assinatura
          let subscriptionLoaded = false;
          
          for (let i = 0; i < 5; i++) {
            try {
              console.log(`[AccountRedirect] Tentativa ${i+1} de carregar dados da assinatura para usuário ${user.id}`);
              await loadUserSubscription(true); // Forçar recarregamento
              subscriptionLoaded = true;
              break;
            } catch (err) {
              console.error(`[AccountRedirect] Erro na tentativa ${i+1}:`, err);
              // Aguardar um período maior entre as tentativas
              if (i < 4) {
                const waitTime = 1000 * (i + 1); // Aumentar o tempo a cada tentativa
                console.log(`[AccountRedirect] Aguardando ${waitTime}ms antes da próxima tentativa`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }
          
          // Indicar sucesso mesmo se não conseguir carregar a assinatura
          // já que pode ser um erro temporário que será resolvido quando
          // o usuário acessar a página de assinatura
          setIsSuccess(true);
          setLoadingMessage('Pagamento confirmado!');
          setIsLoading(false);
          
          // Aguardar um momento para que o usuário veja a mensagem de sucesso
          setTimeout(() => {
            // Redirecionar para a página de assinatura
            navigate('/billing', { replace: true });
          }, 1500);
        } catch (error) {
          console.error('[AccountRedirect] Erro ao carregar dados da assinatura:', error);
          setLoadingMessage('Houve um problema ao atualizar seus dados.');
          setHasError(true);
          setIsLoading(false);
          
          // Mesmo com erro, redirecionar após um tempo
          setTimeout(() => {
            navigate('/billing', { replace: true });
          }, 3000);
        }
      };

      loadSubscriptionAndRedirect();
    }
  }, [authChecked, user, loadUserSubscription, navigate, sessionIdFromUrl]);

  // Mostrar informações de depuração (visível apenas em ambiente de desenvolvimento)
  const showDebugInfo = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e0e10] text-white">
      {isSuccess ? (
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
      ) : hasError ? (
        <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
      ) : (
        <Loader2 className="h-12 w-12 animate-spin text-vegas-gold mb-4" />
      )}
      
      <h1 className="text-2xl font-bold mb-2">
        {isSuccess ? 'Pagamento Confirmado!' : hasError ? 'Atenção' : 'Processando...'}
      </h1>
      
      <p className="text-gray-400 text-center max-w-md">
        {loadingMessage}
      </p>
      
      {!isLoading && !hasError && (
        <div className="mt-6 text-sm text-gray-500">
          Redirecionando para sua assinatura...
        </div>
      )}
      
      {showDebugInfo && userIdFromUrl && (
        <div className="mt-8 p-3 border border-gray-800 rounded max-w-md">
          <h3 className="text-sm font-bold mb-2">Informações de Depuração:</h3>
          <p className="text-xs text-gray-400">User ID da URL: {userIdFromUrl}</p>
          {sessionIdFromUrl && <p className="text-xs text-gray-400">Session ID: {sessionIdFromUrl}</p>}
          <p className="text-xs text-gray-400">Estado de autenticação: {user ? 'Autenticado' : 'Não autenticado'}</p>
        </div>
      )}
    </div>
  );
};

export default AccountRedirect; 