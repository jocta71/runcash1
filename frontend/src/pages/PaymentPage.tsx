import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { PaymentForm } from '@/components/PaymentForm';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const PaymentPage = () => {
  const { planId } = useParams<{ planId: string }>();
  const { availablePlans, loading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && availablePlans && planId) {
      const plan = availablePlans.find(p => p.id === planId);
      if (plan) {
        setSelectedPlan(plan);
      } else {
        toast({
          title: 'Plano não encontrado',
          description: 'O plano selecionado não está disponível.',
          variant: 'destructive'
        });
        navigate('/planos');
      }
    }
  }, [loading, availablePlans, planId, navigate, toast]);

  const handlePaymentSuccess = () => {
    navigate('/payment-success');
  };

  const handleCancel = () => {
    navigate('/planos');
  };

  if (loading || !selectedPlan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <Button 
        variant="ghost" 
        className="mb-6" 
        onClick={() => navigate('/planos')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para planos
      </Button>

      <div className="bg-vegas-black/40 border border-gray-700 rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold mb-2">Finalizar assinatura</h1>
        <p className="text-gray-400 mb-4">
          Você selecionou o plano <span className="font-semibold text-vegas-gold">{selectedPlan.name}</span>
        </p>
        
        <div className="flex items-center justify-between border-t border-gray-700 pt-4 mt-4">
          <div>
            <p className="text-sm text-gray-400">Valor</p>
            <p className="text-xl font-bold">
              {selectedPlan.price === 0 
                ? 'Grátis' 
                : `R$ ${selectedPlan.price.toFixed(2)}/${selectedPlan.interval === 'monthly' ? 'mês' : 'ano'}`}
            </p>
          </div>
          
          {selectedPlan.interval === 'annual' && (
            <div className="bg-vegas-gold/20 text-vegas-gold text-sm px-3 py-1 rounded-full">
              2 meses grátis
            </div>
          )}
        </div>
      </div>

      <PaymentForm 
        planId={planId || ''} 
        onPaymentSuccess={handlePaymentSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default PaymentPage; 