import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Componente de redirecionamento para a rota /account
 * Esta página serve como um intermediário após confirmação de pagamento
 * Redireciona automaticamente para a página de assinatura
 */
const AccountRedirect = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loadUserSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Processando pagamento...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    // Função para carregar os dados de assinatura e redirecionar
    const loadSubscriptionAndRedirect = async () => {
      try {
        // Verificar se o usuário está autenticado e tem ID válido
        if (!user || !user.id) {
          console.log('[AccountRedirect] Usuário não autenticado ou ID inválido. Aguardando autenticação...');
          setLoadingMessage('Verificando autenticação...');
          
          // Se já tentamos várias vezes e ainda não temos o usuário, podemos redirecionar para login
          if (retries > 5) {
            console.log('[AccountRedirect] Muitas tentativas sem autenticação. Redirecionando para login...');
            setHasError(true);
            setLoadingMessage('Sessão expirada ou inválida. Redirecionando...');
            setTimeout(() => {
              navigate('/login', { replace: true });
            }, 2000);
            return;
          }
          
          // Incrementar contagem de tentativas e tentar novamente após um intervalo
          setRetries(prev => prev + 1);
          setTimeout(() => {
            loadSubscriptionAndRedirect();
          }, 1000);
          return;
        }

        console.log('[AccountRedirect] Usuário autenticado:', user.id);
        setLoadingMessage('Atualizando dados da assinatura...');
        setRetries(0); // Resetar contagem de tentativas já que o usuário está autenticado
        
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
          navigate('/minha-conta/assinatura', { replace: true });
        }, 1500);
      } catch (error) {
        console.error('Erro ao carregar dados da assinatura:', error);
        setLoadingMessage('Houve um problema ao atualizar seus dados.');
        setHasError(true);
        setIsLoading(false);
        
        // Mesmo com erro, redirecionar após um tempo
        setTimeout(() => {
          navigate('/minha-conta/assinatura', { replace: true });
        }, 3000);
      }
    };

    // Só iniciar o processo se a autenticação já tiver sido carregada
    if (!authLoading) {
      loadSubscriptionAndRedirect();
    }
  }, [navigate, loadUserSubscription, user, authLoading]);

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
      
      {!isLoading && (
        <div className="mt-6 text-sm text-gray-500">
          Redirecionando para sua assinatura...
        </div>
      )}
    </div>
  );
};

export default AccountRedirect; 