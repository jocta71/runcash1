import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { Check, Loader2 } from 'lucide-react';
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

const PaymentPage = () => {
  const { planId } = useParams();
  const { availablePlans, currentPlan, loading } = useSubscription();
  const { user } = useAuth();
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'annual'>('monthly');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(planId || null);
  
  useEffect(() => {
    // Se um plano foi passado na URL, mostrar o formulário de pagamento imediatamente
    if (planId && user) {
      const planExists = availablePlans.some(plan => plan.id === planId);
      if (planExists) {
        setSelectedPlanId(planId);
        setShowPaymentForm(true);
      } else {
        toast({
          title: "Plano não encontrado",
          description: "O plano selecionado não existe.",
          variant: "destructive"
        });
        navigate('/planos');
      }
    }
  }, [planId, user, availablePlans]);

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
    
    // Mostrar formulário de pagamento
    setSelectedPlanId(planId);
    setShowPaymentForm(true);
  };

  const handlePaymentSuccess = () => {
    toast({
      title: "Assinatura realizada com sucesso!",
      description: "Sua assinatura foi processada com sucesso.",
    });
    setShowPaymentForm(false);
    navigate('/dashboard');
  };

  const handleCancel = () => {
    setShowPaymentForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold text-center mb-10">Escolha seu Plano</h1>
      
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
                currentPlan?.id === plan.id ? 'border-vegas-gold bg-vegas-black/60' : 'border-gray-700 bg-vegas-black/40'
              }`}
            >
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
                      : "bg-vegas-gold hover:bg-vegas-gold/80 text-black"
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

      {showPaymentForm && selectedPlanId && (
        <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pagamento</DialogTitle>
            </DialogHeader>
            <PaymentForm 
              planId={selectedPlanId}
              onPaymentSuccess={handlePaymentSuccess}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PaymentPage; 