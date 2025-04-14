import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { redirectToHublaCheckout } from '@/integrations/hubla/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Função para formatar CPF
const formatCPF = (value: string) => {
  // Remove todos os caracteres não numéricos
  const cleanValue = value.replace(/\D/g, '');
  
  // Aplica a máscara do CPF: XXX.XXX.XXX-XX
  if (cleanValue.length <= 3) {
    return cleanValue;
  } else if (cleanValue.length <= 6) {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3)}`;
  } else if (cleanValue.length <= 9) {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6)}`;
  } else {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6, 9)}-${cleanValue.slice(9, 11)}`;
  }
};

// Função para formatar telefone
const formatPhone = (value: string) => {
  // Remove todos os caracteres não numéricos
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length <= 2) {
    return cleanValue;
  } else if (cleanValue.length <= 7) {
    return `(${cleanValue.slice(0, 2)}) ${cleanValue.slice(2)}`;
  } else {
    return `(${cleanValue.slice(0, 2)}) ${cleanValue.slice(2, 7)}-${cleanValue.slice(7, 11)}`;
  }
};

interface PaymentFormProps {
  planId: string;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

export const PaymentForm = ({ planId, onPaymentSuccess, onCancel }: PaymentFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!user) {
      setError("Você precisa estar logado para assinar um plano.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Redirecionar diretamente para a página de checkout do Hubla
      console.log('Redirecionando para checkout do Hubla...');
      
      // Obter a URL do checkout com base no plano
      const checkoutUrl = redirectToHublaCheckout(planId);
      
      // Mostrar toast informando o redirecionamento
      toast({
        title: "Redirecionando para pagamento",
        description: "Você será redirecionado para a página de pagamento segura da Hubla.",
      });
      
      // Redirecionar para a página de checkout
      window.location.href = checkoutUrl;
      
    } catch (error) {
      console.error('Erro ao redirecionar para checkout:', error);
      
      // Exibir mensagem de erro
      let errorMessage = "Não foi possível redirecionar para a página de pagamento.";
      
      if (error instanceof Error) {
        setError(`${errorMessage} ${error.message}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="w-full p-6 mx-auto rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Confirmar Assinatura</h2>
      <p className="text-gray-400 mb-4">
        Você será redirecionado para a página segura da Hubla para concluir seu pagamento.
      </p>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="pt-2 flex space-x-3">
          <Button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            className="flex-1 bg-vegas-gold hover:bg-vegas-gold/80 text-black"
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : 'Ir para Pagamento'}
          </Button>
        </div>
      </form>
    </div>
  );
}; 