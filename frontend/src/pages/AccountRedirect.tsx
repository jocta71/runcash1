import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';

/**
 * Componente de redirecionamento para a rota /account
 * Esta página serve como um intermediário após confirmação de pagamento
 * Redireciona automaticamente para a página de assinatura
 */
const AccountRedirect = () => {
  const navigate = useNavigate();
  const { loadUserSubscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Processando pagamento...');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Função para carregar os dados de assinatura e redirecionar
    const loadSubscriptionAndRedirect = async () => {
      try {
        setLoadingMessage('Atualizando dados da assinatura...');
        
        // Tentar carregar os dados da assinatura várias vezes
        // para garantir que a API tenha tempo de registrar a assinatura
        for (let i = 0; i < 3; i++) {
          await loadUserSubscription();
          
          // Aguardar um curto período entre as tentativas
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
        
        // Indicar sucesso antes de redirecionar
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
        setLoadingMessage('Houve um problema ao atualizar seus dados. Redirecionando...');
        
        // Mesmo com erro, redirecionar após um tempo
        setTimeout(() => {
          navigate('/minha-conta/assinatura', { replace: true });
        }, 2000);
      }
    };

    // Iniciar o processo de carregamento e redirecionamento
    loadSubscriptionAndRedirect();
  }, [navigate, loadUserSubscription]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e0e10] text-white">
      {isSuccess ? (
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
      ) : (
        <Loader2 className="h-12 w-12 animate-spin text-vegas-gold mb-4" />
      )}
      
      <h1 className="text-2xl font-bold mb-2">
        {isSuccess ? 'Pagamento Confirmado!' : 'Processando...'}
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