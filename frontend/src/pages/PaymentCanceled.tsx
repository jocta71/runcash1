import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PaymentCanceled = () => {
  const navigate = useNavigate();
  
  return (
    <div className="container mx-auto max-w-md py-20 px-4 text-center">
      <div className="bg-vegas-black p-8 rounded-xl border border-gray-800 shadow-xl">
        <div className="flex justify-center mb-6">
          <AlertTriangle className="h-20 w-20 text-yellow-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-4">Pagamento Cancelado</h1>
        
        <p className="text-gray-400 mb-8">
          O processo de pagamento foi cancelado ou interrompido. 
          Sua assinatura não foi ativada e nenhum valor foi cobrado.
        </p>
        
        <div className="space-y-4">
          <Button 
            className="w-full bg-vegas-gold hover:bg-vegas-gold/90 text-black"
            onClick={() => navigate('/planos')}
          >
            Tentar Novamente
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full border-gray-700 hover:bg-gray-800"
            onClick={() => navigate('/')}
          >
            Voltar para página inicial
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentCanceled; 