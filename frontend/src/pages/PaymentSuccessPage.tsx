import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle } from 'react-bootstrap-icons';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';

/**
 * Página de sucesso após confirmação do pagamento
 */
const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, checkAuth, token } = useAuth();
  const { showLoginModal } = useLoginModal();
  const queryParams = new URLSearchParams(location.search);
  const planId = queryParams.get('plan');
  const sessionId = queryParams.get('session_id');
  const userId = queryParams.get('userId');
  
  const [countdown, setCountdown] = useState<number>(5);
  const [authChecked, setAuthChecked] = useState(false);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [isPaused, setIsPaused] = useState(false);
  
  // Verificar autenticação ao montar o componente
  useEffect(() => {
    const verifyAuth = async () => {
      console.log('[PaymentSuccess] Verificando autenticação...');
      console.log('[PaymentSuccess] Token atual:', token ? `${token.substring(0, 15)}...` : 'Nenhum');
      
      try {
        // Verificar se há token no localStorage (fallback)
        const backupToken = localStorage.getItem('auth_token_backup');
        if (!token && backupToken) {
          console.log('[PaymentSuccess] Encontrado token de backup no localStorage');
        }
        
        // Verificar autenticação
        const isAuthenticated = await checkAuth();
        console.log('[PaymentSuccess] Resultado da verificação:', isAuthenticated ? 'Autenticado' : 'Não autenticado');
        
        setAuthStatus(isAuthenticated ? 'authenticated' : 'unauthenticated');
        
        // Se não estiver autenticado mas temos userId, tente recuperar a sessão
        if (!isAuthenticated && userId) {
          console.log(`[PaymentSuccess] Tentativa de restaurar sessão para userId=${userId}`);
          
          // Mostrar modal de login com mensagem específica
          setIsPaused(true); // Pausa a contagem regressiva
          showLoginModal({
            redirectAfterLogin: '/billing',
            message: 'Por favor, faça login novamente para acessar sua conta e verificar sua assinatura.'
          });
        }
      } catch (error) {
        console.error('[PaymentSuccess] Erro ao verificar autenticação:', error);
        setAuthStatus('unauthenticated');
      } finally {
        setAuthChecked(true);
      }
    };
    
    verifyAuth();
  }, [checkAuth, userId, showLoginModal, token]);
  
  // Redirecionar automaticamente após 5 segundos
  useEffect(() => {
    if (!authChecked || isPaused) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirecionar para a página adequada com base no estado de autenticação
          if (authStatus === 'authenticated') {
            navigate('/billing');
          } else {
            // Navegar para a página inicial preservando o state para mostrar o modal de login
            navigate('/', { 
              state: { 
                showLoginModal: true,
                message: 'Por favor, faça login para acessar sua conta e ver sua assinatura.',
                redirectAfterLogin: '/billing'
              } 
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [navigate, authChecked, authStatus, isPaused]);
  
  // Mostrar informações de depuração (visível apenas em ambiente de desenvolvimento)
  const showDebugInfo = process.env.NODE_ENV === 'development';
  
  const handleManualLogin = () => {
    // Mostrar modal de login com redirecionamento para a página da conta
    showLoginModal({
      redirectAfterLogin: '/billing',
      message: 'Por favor, faça login para acessar sua conta e verificar sua assinatura.'
    });
  };
  
  return (
    <div className="container my-5">
      <div className="flex justify-center">
        <div className="w-full max-w-lg">
          <Card className="shadow">
            <CardContent className="py-5 text-center">
              <div className="mb-4 text-green-500">
                <CheckCircle size={80} />
              </div>
              
              <h2 className="mb-3 text-2xl font-bold">Pagamento Confirmado!</h2>
              
              <p className="mb-4">
                {planId ? (
                  <>
                    Seu pagamento para o plano <strong>{planId}</strong> foi processado com sucesso.
                    <br />
                    Sua assinatura está agora ativa.
                  </>
                ) : (
                  'Seu pagamento foi processado com sucesso.'
                )}
              </p>
              
              <p className="text-muted mb-4 text-gray-500">
                {authStatus === 'authenticated' 
                  ? `Você será redirecionado para sua conta em ${countdown} segundos...`
                  : isPaused
                    ? 'Por favor, faça login para continuar.'
                    : 'Você será redirecionado para a página inicial em ' + countdown + ' segundos...'}
              </p>
              
              <div className="flex justify-center gap-4">
                {authStatus === 'authenticated' ? (
                  <Button 
                    variant="default" 
                    onClick={() => navigate('/billing')}
                  >
                    Ir para minha conta
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    onClick={handleManualLogin}
                  >
                    Fazer login
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Voltar ao início
                </Button>
              </div>
              
              {showDebugInfo && (
                <div className="mt-5 text-left text-xs text-gray-500 border-t pt-3">
                  <p><strong>Debug:</strong> {sessionId ? 'Session ID: ' + sessionId : 'Sem Session ID'}</p>
                  <p>Auth Status: {authStatus}</p>
                  <p>User ID: {user?.id || userId || 'Não disponível'}</p>
                  <p>Countdown pausado: {isPaused ? 'Sim' : 'Não'}</p>
                  <p>Token disponível: {token ? 'Sim' : 'Não'}</p>
                  <p>Token backup: {localStorage.getItem('auth_token_backup') ? 'Sim' : 'Não'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage; 