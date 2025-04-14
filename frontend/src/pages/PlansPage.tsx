import { useState, useEffect } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { PlanType } from '@/types/plans';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
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
import { redirectToHublaCheckout, verifyCheckoutEligibility } from '@/integrations/hubla/client';
import Cookies from 'js-cookie';

const PlansPage = () => {
  const { availablePlans, currentPlan, loading } = useSubscription();
  const { user, isAuthenticated, checkAuth, setUser, setToken } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  
  // Função auxiliar para obter o ID do usuário de forma segura
  const getUserId = () => {
    return user?.id || (user as any)?._id;
  };

  // Log de depuração inicial ao montar o componente
  useEffect(() => {
    console.log('PlansPage montada - Estado inicial:', {
      isAuthenticated,
      user,
      currentPath: location.pathname,
      currentPlan
    });
  }, []);

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
  
  const handleSelectPlan = async (planId: string) => {
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
      
      // Verificar elegibilidade do usuário para checkout (pode ser redundante, mas mantido por segurança)
      const eligibility = verifyCheckoutEligibility(user!);
      console.log('Resultado da verificação de elegibilidade:', eligibility);
      
      if (!eligibility.isEligible) {
        console.log('Usuário não é elegível para checkout:', eligibility.message);
        toast({
          title: "Login necessário",
          description: eligibility.message || "Você precisa estar logado para assinar um plano.",
          variant: "destructive"
        });
        navigate('/login', { state: { returnUrl: `/planos` } });
        return;
      }
      
      // Preservar dados de autenticação antes do redirecionamento
      preserveAuthData();
      
      // Obter a URL do checkout com base no plano
      console.log('Obtendo URL de checkout para planId:', planId, 'e userId:', userId);
      const checkoutUrl = redirectToHublaCheckout(planId, userId);
      console.log('URL de checkout gerada:', checkoutUrl);
      
      // Verificar se a URL foi gerada corretamente
      if (!checkoutUrl) {
        console.error('Falha ao gerar URL de checkout');
        throw new Error("Não foi possível gerar a URL de checkout");
      }
      
      // Mostrar toast informando o redirecionamento
      toast({
        title: "Redirecionando para pagamento",
        description: "Você será redirecionado para a página de pagamento segura da Hubla.",
      });
      
      console.log('Redirecionando para URL de checkout:', checkoutUrl);
      
      // Armazenar URL de retorno no localStorage
      try {
        localStorage.setItem('checkout_return_url', '/planos');
      } catch (error) {
        console.warn('Não foi possível salvar URL de retorno:', error);
      }
      
      // Tentar redirecionar para a URL de checkout
      try {
        // Adicionar um pequeno atraso para garantir que o toast seja exibido
        setTimeout(() => {
          // Adicionar evento para detectar quando o usuário retornar do checkout
          window.addEventListener('beforeunload', () => {
            // Esta função será executada quando o usuário sair da página
            preserveAuthData();
          }, { once: true });
          
          // Usar window.location.href para uma navegação completa da página
          window.location.href = checkoutUrl;
        }, 1000);
      } catch (redirectError) {
        console.error('Erro durante o redirecionamento:', redirectError);
        throw new Error("Falha ao redirecionar para a página de pagamento");
      }
    } catch (error) {
      console.error('Erro ao redirecionar para checkout:', error);
      setIsCheckingAuth(false);
      
      // Exibir mensagem de erro como toast com detalhes específicos
      toast({
        title: "Erro no redirecionamento",
        description: error instanceof Error ? error.message : "Não foi possível redirecionar para a página de pagamento.",
        variant: "destructive"
      });
      
      // Se o erro for relacionado ao ID do usuário, sugerir login novamente
      if (error instanceof Error && error.message.includes("usuário")) {
        toast({
          title: "Problema com autenticação",
          description: "Por favor, tente fazer login novamente.",
          variant: "destructive"
        });
        setTimeout(() => navigate('/login', { state: { returnUrl: `/planos` } }), 2000);
      }
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
    <div className="container mx-auto py-20 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold text-center mb-2">Escolha o plano ideal para você</h1>
      <p className="text-gray-400 text-center mb-10">
        Assine e tenha acesso a todos os recursos da plataforma.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {filteredPlans.map(plan => (
          <div 
            key={plan.id}
            className={`border rounded-lg p-6 flex flex-col ${
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
              <h3 className="text-xl font-bold">{plan.name}</h3>
              {currentPlan?.id === plan.id && (
                <span className="bg-vegas-gold text-black text-xs px-2 py-1 rounded-full">
                  Plano Atual
                </span>
              )}
            </div>
            
            <div className="mt-4 mb-2">
              <span className="text-3xl font-bold">
                {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
              </span>
              {plan.price > 0 && (
                <span className="text-sm text-gray-400">
                  /mês
                </span>
              )}
            </div>
            
            <p className="text-gray-400 text-sm mb-6">{plan.description}</p>
            
            <ul className="space-y-3 mb-6 flex-grow">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start">
                  <Check className="h-5 w-5 text-vegas-gold mr-2 flex-shrink-0 mt-0.5" />
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
      
      <div className="mt-12 bg-vegas-black/30 p-6 rounded-lg border border-gray-800">
        <h2 className="text-xl font-bold mb-4">Dúvidas Frequentes</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Como funciona o sistema de assinatura?</h3>
            <p className="text-sm text-gray-400">
              Nossas assinaturas são cobradas mensalmente, e o pagamento é processado via PIX através da plataforma Hubla.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h3>
            <p className="text-sm text-gray-400">
              Sim, você pode cancelar sua assinatura a qualquer momento. O acesso aos recursos premium permanecerá ativo até o final do período pago.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlansPage; 