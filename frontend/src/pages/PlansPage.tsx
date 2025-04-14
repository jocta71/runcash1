import { useState, useEffect } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { Plan, PlanType } from '@/types/plans';
import { Check, AlertCircle, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from '@/context/AuthContext';
import { PaymentForm } from '@/components/PaymentForm';
import { useNavigate, useLocation } from 'react-router-dom';
import { redirectToAsaasCheckout } from '@/integrations/asaas/client';
import { verifyCheckoutEligibility } from '@/utils/asaas-helpers';
import Cookies from 'js-cookie';
import Sidebar from '@/components/Sidebar';

interface UserWithId {
  id?: string;
  _id?: string;
  // outras propriedades do usuário
}

const PlansPage = () => {
  const { availablePlans, currentPlan, loading } = useSubscription();
  const { user, isAuthenticated, checkAuth, setUser, setToken } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  
  // Função auxiliar para obter o ID do usuário de forma segura
  const getUserId = () => {
    if (!user) return undefined;
    // Tratando user como um objeto genérico com possíveis propriedades id ou _id
    const userObj = user as UserWithId;
    return userObj.id || userObj._id;
  };

  // Log de depuração inicial ao montar o componente
  useEffect(() => {
    console.log('PlansPage montada - Estado inicial:', {
      isAuthenticated,
      user,
      currentPath: location.pathname,
      currentPlan
    });
  }, [isAuthenticated, user, location.pathname, currentPlan]);

  // Garantir que os dados de autenticação sejam preservados no localStorage
  const preserveAuthData = () => {
    try {
      // Obter o token do cookie
      const token = Cookies.get('token');
      if (token) {
        console.log('Preservando token no localStorage como backup antes do redirecionamento');
        localStorage.setItem('auth_token_backup', token);
        
        // Reforçar o cookie com prazo de validade estendido
        Cookies.set('token', token, { 
          expires: 30, 
          path: '/',
          secure: true,
          sameSite: 'lax'
        });
      }
    } catch (error) {
      console.error('Erro ao preservar dados de autenticação:', error);
    }
  };

  // Função para verificar autenticação sem depender do localStorage
  const verifyAuthSafely = async () => {
    // Tenta usar o token do cookie diretamente para verificar autenticação
    try {
      setIsCheckingAuth(true);
      
      // Verifica se o user já está no estado
      if (user && getUserId()) {
        console.log('Usuário já está no estado, não precisa verificar autenticação:', getUserId());
        return true;
      }
      
      // Tenta obter o token do cookie
      const token = Cookies.get('token');
      console.log('Token encontrado no cookie:', !!token);
      
      // Se não tiver token, já retorna falso
      if (!token) {
        console.log('Nenhum token encontrado no cookie');
        return false;
      }
      
      // Tenta verificar autenticação via API
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
          // Atualiza o estado do contexto de autenticação
          setUser(data.data);
          setToken(token);
          console.log('Autenticação verificada com sucesso via API');
          return true;
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação via API:', error);
      }
      
      // Se chegou até aqui, tenta o checkAuth padrão como fallback
      try {
        return await checkAuth();
      } catch (error) {
        console.error('Erro no checkAuth padrão:', error);
        return false;
      }
    } catch (error) {
      console.error('Erro geral ao verificar autenticação:', error);
      return false;
    } finally {
      setIsCheckingAuth(false);
    }
  };
  
  // Verificar autenticação ao carregar a página
  useEffect(() => {
    const verifyAuthentication = async () => {
      // Log para depuração
      console.log('Verificando estado de autenticação:', { 
        isAuthenticated, 
        userId: getUserId(),
        user
      });
      
      // Se o usuário não estiver logado, tentar verificar autenticação usando o método seguro
      if (!isAuthenticated) {
        const isAuth = await verifyAuthSafely();
        
        if (!isAuth) {
          // Se ainda não estiver autenticado, mostrar alerta
          toast({
            title: "Aviso de autenticação",
            description: "Você precisa estar logado para assinar um plano.",
            variant: "default"
          });
          
          // Redirecionar para login após breve pausa
          setTimeout(() => {
            navigate('/login', { state: { returnUrl: `/planos` } });
          }, 2000);
        }
      } else {
        console.log('Usuário autenticado:', getUserId());
      }
    };
    
    verifyAuthentication();
  }, [isAuthenticated, user, toast, navigate]);
  
  const handleSelectPlan = async (planId: PlanType) => {
    console.log('handleSelectPlan iniciado com plano:', planId);
    
    // Se já for o plano atual, apenas mostrar mensagem
    if (currentPlan?.id === planId) {
      toast({
        title: "Plano já ativo",
        description: "Você já está inscrito neste plano.",
      });
      return;
    }
    
    try {
      // Mostrar indicador de carregamento
      setIsCheckingAuth(true);
      
      console.log('Iniciando verificação de autenticação para checkout...');
      
      // Verifica autenticação de forma segura sem depender do localStorage
      const isAuth = await verifyAuthSafely();
      console.log('Resultado da verificação de autenticação:', isAuth);
      
      setIsCheckingAuth(false);
      
      if (!isAuth) {
        console.log('Usuário não está autenticado. Redirecionando para login...');
        toast({
          title: "Login necessário",
          description: "Você precisa estar logado para assinar um plano.",
          variant: "destructive"
        });
        navigate('/login', { state: { returnUrl: `/planos` } });
        return;
      }
      
      // Neste ponto, sabemos que o usuário está autenticado e temos acesso aos dados do usuário
      const userId = getUserId();
      if (!userId) {
        console.error('ID do usuário não disponível mesmo após verificação de autenticação bem-sucedida');
        throw new Error("ID do usuário não disponível. Por favor, faça login novamente.");
      }
      
      console.log('Dados do usuário completos:', user);
      console.log('Iniciando checkout com:', { planId, userId });
      
      // Verificar elegibilidade do usuário para checkout
      const eligibilityResult = verifyCheckoutEligibility(user!);
      console.log('Resultado da verificação de elegibilidade:', eligibilityResult);
      
      if (!eligibilityResult.isEligible) {
        console.log('Usuário não é elegível para checkout:', eligibilityResult.message);
        toast({
          title: "Login necessário",
          description: eligibilityResult.message || "Você precisa estar logado para assinar um plano.",
          variant: "destructive"
        });
        navigate('/login', { state: { returnUrl: `/planos` } });
        return;
      }
      
      // Preservar dados de autenticação antes do redirecionamento
      preserveAuthData();
      
      // Mostrar toast informando o redirecionamento
      toast({
        title: "Redirecionando para pagamento",
        description: "Você será redirecionado para a página de pagamento segura do Asaas.",
      });
      
      // Redirecionar para o checkout do Asaas
      console.log('Redirecionando para checkout do Asaas...');
      const success = redirectToAsaasCheckout({
        planId,
        user,
        isAuthenticated: true
      });
      
      if (!success) {
        throw new Error("Não foi possível redirecionar para o checkout. Tente novamente.");
      }
      
    } catch (error) {
      console.error('Erro ao processar checkout:', error);
      setIsCheckingAuth(false);
      
      toast({
        title: "Erro no processo de pagamento",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    }
  };

  if (loading || isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-gray-400">
          {isCheckingAuth ? "Verificando autenticação..." : "Carregando planos..."}
        </span>
      </div>
    );
  }

  // Filtrar apenas os planos Basic e Pro (mensal)
  const filteredPlans = availablePlans
    .filter(plan => ['basic', 'pro'].includes(plan.id) && plan.interval === 'monthly');

  return (
    <div className="flex min-h-screen bg-vegas-black">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-vegas-gold mb-8">Meu Plano</h1>
        
        <div className="bg-vegas-black/60 rounded-lg border border-gray-800 p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Plano Atual</h2>
            
            {currentPlan ? (
              <span className="bg-vegas-gold text-black text-xs px-3 py-1 rounded-full">
                {currentPlan.name}
              </span>
            ) : (
              <span className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                Nenhum plano ativo
              </span>
            )}
          </div>
          
          {currentPlan ? (
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Nome do plano</p>
                  <p className="text-white font-medium">{currentPlan.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Valor</p>
                  <p className="text-white font-medium">
                    {currentPlan.price > 0 ? `R$ ${currentPlan.price.toFixed(2)}/mês` : 'Grátis'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Status</p>
                  <p className="text-white font-medium">Ativo</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">ID do plano</p>
                  <p className="text-white font-medium">{currentPlan.id}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 mb-4">Você ainda não possui um plano ativo. Escolha um dos planos abaixo para começar.</p>
          )}
        </div>
        
        <div className="bg-vegas-black/60 rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-bold mb-6">Escolha seu plano</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPlans.map(plan => (
              <div 
                key={plan.id}
                className={`border rounded-lg p-5 flex flex-col ${
                  currentPlan?.id === plan.id 
                    ? 'border-vegas-gold bg-vegas-black/60 relative overflow-hidden' 
                    : plan.id === 'pro' 
                      ? 'border-vegas-gold bg-vegas-black/60 relative overflow-hidden' 
                      : 'border-gray-700 bg-vegas-black/40'
                }`}
              >
                {plan.id === 'pro' && (
                  <div className="absolute right-0 top-0 bg-vegas-gold text-black text-xs px-4 py-1 transform translate-x-2 translate-y-3 rotate-45">
                    Popular
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  {currentPlan?.id === plan.id && (
                    <span className="bg-vegas-gold text-black text-xs px-2 py-1 rounded-full">
                      Plano Atual
                    </span>
                  )}
                </div>
                
                <div className="mt-4 mb-2">
                  <span className="text-2xl font-bold">
                    {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-gray-400">
                      /mês
                    </span>
                  )}
                </div>
                
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                
                <ul className="space-y-2 mb-6 flex-grow">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="h-4 w-4 text-vegas-gold mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={
                    currentPlan?.id === plan.id 
                      ? "bg-gray-700 hover:bg-gray-600" 
                      : plan.id === 'pro'
                        ? "bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                        : "bg-vegas-gold/80 hover:bg-vegas-gold text-black"
                  }
                  disabled={currentPlan?.id === plan.id}
                >
                  {currentPlan?.id === plan.id 
                    ? "Plano Atual" 
                    : "Assinar Agora"}
                </Button>
              </div>
            ))}
          </div>
          
          <div className="mt-8 p-4 bg-vegas-black/40 rounded-lg border border-gray-800">
            <h3 className="font-semibold mb-2">Informações de pagamento</h3>
            <p className="text-sm text-gray-400 mb-2">
              • O pagamento é processado de forma segura via PIX através da plataforma Asaas.
            </p>
            <p className="text-sm text-gray-400 mb-2">
              • Você pode cancelar sua assinatura a qualquer momento.
            </p>
            <p className="text-sm text-gray-400">
              • Em caso de dúvidas, entre em contato com nosso suporte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlansPage; 