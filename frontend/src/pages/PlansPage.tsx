import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import axios from 'axios';

// URL da API do Railway
const API_URL = "https://backendapi-production-36b5.up.railway.app/api";

const PlansPage = () => {
  const { availablePlans, currentPlan, loading, refetchSubscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  
  // Função para criar um checkout para assinatura
  const createSubscriptionCheckout = async (planId: string) => {
    try {
      setProcessingPlan(planId);
      
      // Obter o preço do plano
      const plan = availablePlans.find(p => p.id === planId);
      if (!plan) {
        throw new Error("Plano não encontrado");
      }
      
      console.log(`Chamando API ${API_URL}/checkout/subscription`);
      
      const response = await axios.post(
        `${API_URL}/checkout/subscription`, 
        { 
          planType: planId.toUpperCase(),
          planPrice: plan.price
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.data.success && response.data.checkoutUrl) {
        // Redirecionar o usuário para o checkout do Asaas
        window.location.href = response.data.checkoutUrl;
      } else {
        throw new Error(response.data.message || "Erro ao criar checkout");
      }
    } catch (error: any) {
      console.error("Erro ao criar checkout:", error);
      toast({
        title: "Erro ao processar pagamento",
        description: error.response?.data?.message || error.message || "Ocorreu um erro ao processar o pagamento.",
        variant: "destructive"
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleSelectPlan = (planId: string) => {
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
    
    // Iniciar o processo de checkout
    createSubscriptionCheckout(planId);
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

  // Remover plano gratuito (basic) da exibição
  const displayPlans = availablePlans.filter(plan => plan.id !== 'basic');

  return (
    <Layout>
      <div className="container py-8 space-y-8">
        <h1 className="text-3xl font-bold text-center mb-2">Escolha o plano ideal para você</h1>
        <p className="text-gray-400 text-center mb-10">
          Assine e tenha acesso a todos os recursos da plataforma.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {displayPlans.map(plan => (
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
                disabled={currentPlan?.id === plan.id || processingPlan === plan.id}
              >
                {currentPlan?.id === plan.id 
                  ? "Plano Atual" 
                  : processingPlan === plan.id
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando</>
                  : "Assinar Agora"}
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
                Nossas assinaturas são cobradas mensalmente e o pagamento é processado através da plataforma Asaas, oferecendo opções de pagamento via PIX, boleto ou cartão de crédito.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h3>
              <p className="text-sm text-gray-400">
                Sim, você pode cancelar sua assinatura a qualquer momento. O acesso aos recursos premium permanecerá ativo até o final do período pago.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Quais formas de pagamento são aceitas?</h3>
              <p className="text-sm text-gray-400">
                Aceitamos pagamentos via PIX, boleto bancário e cartão de crédito, todos processados de forma segura pela plataforma Asaas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PlansPage; 