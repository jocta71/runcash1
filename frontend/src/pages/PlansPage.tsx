import { useState, useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import axios from 'axios';

interface CheckoutResponse {
  success: boolean;
  checkoutUrl?: string;
  message?: string;
  error?: string;
}

const PlansPage = () => {
  const { availablePlans, currentPlan, loading, refreshSubscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  
  useEffect(() => {
    // Verificar se o usuário veio de um redirecionamento do Asaas após pagamento
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    
    if (paymentStatus) {
      if (paymentStatus === 'success') {
        toast({
          title: "Pagamento recebido!",
          description: "Seu pagamento foi recebido e está sendo processado. Sua assinatura estará ativa em instantes.",
        });
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Atualizar dados da assinatura
        refreshSubscription();
      } else if (paymentStatus === 'pending') {
        toast({
          title: "Pagamento pendente",
          description: "Seu pagamento está pendente de confirmação. Avisaremos quando for processado.",
        });
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === 'error') {
        toast({
          title: "Erro no pagamento",
          description: "Houve um problema com seu pagamento. Por favor, tente novamente.",
          variant: "destructive"
        });
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [toast, refreshSubscription]);
  
  const handleSelectPlan = async (planId: string) => {
    // Resetar estado de erro
    setCheckoutError(null);
    
    // Se já for o plano atual, apenas mostrar mensagem
    if (currentPlan?.id === planId) {
      toast({
        title: "Plano já ativo",
        description: "Você já está inscrito neste plano.",
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive"
      });
      navigate('/', { state: { showLoginModal: true } });
      return;
    }
    
    // Marcar plano como em processamento
    setProcessingPlan(planId);
    
    try {
      // Chamar API para criar checkout
      const response = await axios.post<CheckoutResponse>('/api/subscriptions/checkout', {
        planId,
        userId: user.id
      });
      
      if (response.data.success && response.data.checkoutUrl) {
        // Redirecionar para URL de checkout do Asaas
        window.location.href = response.data.checkoutUrl;
      } else {
        // Mostrar erro
        setCheckoutError(response.data.message || 'Erro ao processar checkout');
        toast({
          title: "Erro ao processar",
          description: response.data.message || "Não foi possível criar o checkout de assinatura.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao processar checkout:', error);
      setCheckoutError('Falha na comunicação com o servidor');
      toast({
        title: "Erro no servidor",
        description: "Falha na comunicação com o servidor de pagamentos. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  // Filtrar apenas os planos Profissional (49,90) e Premium (99,90)
  const filteredPlans = availablePlans
    .filter(plan => (plan.price === 49.90 || plan.price === 99.90) && plan.interval === 'monthly');

  return (
    <Layout>
      <div className="container py-8 space-y-8">
        <h1 className="text-3xl font-bold text-center mb-2">Escolha o plano ideal para você</h1>
        <p className="text-gray-400 text-center mb-10">
          Assine e tenha acesso a todos os recursos da plataforma.
        </p>

        {checkoutError && (
          <div className="bg-red-900/30 border border-red-700 p-4 rounded-lg flex items-center gap-3 mb-6 max-w-4xl mx-auto">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-300">{checkoutError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
                  R$ {plan.price.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400">
                  /mês
                </span>
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
                disabled={currentPlan?.id === plan.id || processingPlan !== null}
              >
                {processingPlan === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : currentPlan?.id === plan.id ? (
                  "Plano Atual"
                ) : (
                  "Assinar Agora"
                )}
              </Button>
            </div>
          ))}
        </div>
        
        <div className="mt-12 bg-vegas-black/30 p-6 rounded-lg border border-gray-800 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4">Dúvidas Frequentes</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Como funciona o sistema de assinatura?</h3>
              <p className="text-sm text-gray-400">
                Nossas assinaturas são cobradas mensalmente e o pagamento é processado via PIX através da plataforma Asaas.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h3>
              <p className="text-sm text-gray-400">
                Sim, você pode cancelar sua assinatura a qualquer momento. O acesso aos recursos premium permanecerá ativo até o final do período pago.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Quanto tempo leva para minha assinatura ser ativada?</h3>
              <p className="text-sm text-gray-400">
                Com pagamento via PIX, sua assinatura é ativada em até 5 minutos após a confirmação do pagamento.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Posso usar cartão de crédito?</h3>
              <p className="text-sm text-gray-400">
                Sim, aceitamos pagamentos via PIX ou cartão de crédito. Ambas opções estão disponíveis no checkout.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PlansPage; 