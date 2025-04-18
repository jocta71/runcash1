import { useState } from 'react';
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
import { useNavigate } from 'react-router-dom';

const PlansPage = () => {
  const { availablePlans, currentPlan, loading } = useSubscription();
  const { user } = useAuth();
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'annual'>('monthly');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
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
      navigate('/login', { state: { returnUrl: `/pagamento/${planId}` } });
      return;
    }
    
    // Redirecionar para a página de pagamento
    navigate(`/pagamento/${planId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-20 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold text-center mb-2">Escolha o plano ideal para você</h1>
      <p className="text-gray-400 text-center mb-10">
        Assine e tenha acesso a todos os recursos da plataforma.
      </p>
      
      <div className="flex justify-center mb-8">
        <div className="flex bg-gray-800 p-1 rounded-lg">
          <button
            className={`px-4 py-2 rounded-md transition ${
              selectedInterval === 'monthly' ? 'bg-vegas-gold text-black' : 'text-white'
            }`}
            onClick={() => setSelectedInterval('monthly')}
          >
            Mensal
          </button>
          <button
            className={`px-4 py-2 rounded-md transition ${
              selectedInterval === 'annual' ? 'bg-vegas-gold text-black' : 'text-white'
            }`}
            onClick={() => setSelectedInterval('annual')}
          >
            Anual <span className="text-xs">(2 meses grátis)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {availablePlans
          .filter(plan => plan.interval === selectedInterval)
          .map(plan => (
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
                    /{selectedInterval === 'monthly' ? 'mês' : 'ano'}
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
                    : plan.id === 'free' 
                      ? "bg-gray-700 hover:bg-gray-600" 
                      : plan.id === 'pro'
                        ? "bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                        : "bg-vegas-gold/80 hover:bg-vegas-gold text-black"
                }
                disabled={currentPlan?.id === plan.id}
              >
                {currentPlan?.id === plan.id 
                  ? "Plano Atual" 
                  : plan.id === 'free' 
                    ? "Ativar Plano Gratuito" 
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
              Nossas assinaturas são cobradas mensalmente ou anualmente, dependendo do plano escolhido. O pagamento é processado via PIX através da plataforma Asaas.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h3>
            <p className="text-sm text-gray-400">
              Sim, você pode cancelar sua assinatura a qualquer momento. O acesso aos recursos premium permanecerá ativo até o final do período pago.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Como funciona o plano anual?</h3>
            <p className="text-sm text-gray-400">
              Os planos anuais são cobrados de uma vez só, mas oferecem o equivalente a 2 meses grátis em comparação com o pagamento mensal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlansPage; 