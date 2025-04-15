import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Extrair parâmetros da URL
    const params = new URLSearchParams(location.search);
    const free = params.get('free');
    const session = params.get('session_id');

    if (free === 'true') {
      setIsFreePlan(true);
    }

    if (session) {
      setSessionId(session);
    }

    // Mostrar mensagem de sucesso
    toast({
      title: 'Pagamento processado',
      description: isFreePlan 
        ? 'Plano gratuito ativado com sucesso!' 
        : 'Seu pagamento foi processado com sucesso!',
      variant: 'default'
    });
  }, [location.search, toast, isFreePlan]);

  return (
    <div className="container mx-auto py-16 px-4 max-w-2xl text-center">
      <div className="flex flex-col items-center justify-center">
        <div className="bg-green-500/20 p-4 rounded-full mb-6">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>

        <h1 className="text-3xl font-bold mb-2">Pagamento Confirmado!</h1>
        
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          {isFreePlan 
            ? 'Seu plano gratuito foi ativado com sucesso. Você já pode começar a usar todos os recursos disponíveis.'
            : 'Seu pagamento foi processado com sucesso. Assim que confirmarmos o recebimento, sua assinatura será ativada.'}
        </p>

        {sessionId && (
          <p className="text-sm text-gray-500 mb-8">
            ID da transação: {sessionId}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs mx-auto">
          <Button 
            onClick={() => navigate('/dashboard')}
            className="bg-vegas-gold hover:bg-vegas-gold/80 text-black"
          >
            Ir para o Dashboard
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage; 