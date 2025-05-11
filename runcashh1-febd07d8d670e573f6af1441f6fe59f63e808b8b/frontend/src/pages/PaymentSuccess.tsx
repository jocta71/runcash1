import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/context/SubscriptionContext';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { loadUserSubscription } = useSubscription();
  
  useEffect(() => {
    // Carregar dados da assinatura atualizada
    loadUserSubscription().catch(error => {
      console.error('Erro ao carregar informações da assinatura:', error);
    });
    
    // Exibir mensagem de sucesso
    toast({
      title: "Pagamento realizado com sucesso!",
      description: "Sua assinatura foi ativada.",
    });
    
    // Registrar para análise (evento de conversão)
    try {
      // Aqui você pode adicionar código para rastreamento de conversão
      // como Google Analytics, Facebook Pixel, etc.
      console.log('Conversão registrada: assinatura bem-sucedida');
    } catch (error) {
      console.error('Erro ao registrar conversão:', error);
    }
  }, []);
  
  return (
    <div className="container mx-auto max-w-md py-20 px-4 text-center">
      <div className="bg-vegas-black p-8 rounded-xl border border-vegas-gold/30 shadow-xl">
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-20 w-20 text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-4">Pagamento Confirmado!</h1>
        
        <p className="text-gray-400 mb-8">
          Sua assinatura foi ativada com sucesso. Agora você tem acesso a todos os recursos do seu plano.
        </p>
        
        <div className="space-y-4">
          <Button 
            className="w-full bg-vegas-gold hover:bg-vegas-gold/90 text-black"
            onClick={() => navigate('/dashboard')}
          >
            Ir para o Dashboard
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full border-vegas-gold/50 text-vegas-gold hover:bg-vegas-gold/10"
            onClick={() => navigate('/profile')}
          >
            Ver Minha Assinatura
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess; 