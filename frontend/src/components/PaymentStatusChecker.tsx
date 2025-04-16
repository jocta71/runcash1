import { useEffect, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { findAsaasPayment } from '@/integrations/asaas/client';
import { Loader2 } from 'lucide-react';

interface PaymentStatus {
  status: 'CONFIRMED' | 'RECEIVED' | 'PENDING' | 'OVERDUE' | 'REFUNDED' | string;
  value: number;
  billingType: string;
  invoiceUrl?: string;
  dueDate: string;
}

interface PaymentStatusCheckerProps {
  paymentId: string;
  onPaymentConfirmed: () => void;
}

export const PaymentStatusChecker = ({ paymentId, onPaymentConfirmed }: PaymentStatusCheckerProps) => {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        console.log('Verificando status do pagamento:', paymentId);
        const response = await findAsaasPayment(paymentId);
        
        if (!response || typeof response.status !== 'string') {
          throw new Error('Resposta inválida do servidor');
        }

        console.log('Status recebido:', response);
        setPaymentStatus(response as PaymentStatus);
        
        if (response.status === 'CONFIRMED' || response.status === 'RECEIVED') {
          console.log('Pagamento confirmado!');
          toast({
            title: "Pagamento confirmado!",
            description: "Seu pagamento foi processado com sucesso.",
            duration: 5000,
            variant: "default"
          });
          onPaymentConfirmed();
        } else if (response.status === 'PENDING') {
          // Continuar verificando
          timeoutId = setTimeout(checkStatus, 5000);
        } else if (response.status === 'OVERDUE') {
          setError("Pagamento vencido. Por favor, gere um novo pagamento.");
        } else if (response.status === 'REFUNDED') {
          setError("Pagamento reembolsado.");
        } else {
          setError(`Status do pagamento: ${response.status}`);
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        
        if (error instanceof Error) {
          if (error.message.includes('404')) {
            setError("Pagamento não encontrado. Por favor, tente novamente.");
          } else if (error.message.includes('Network Error')) {
            setError("Erro de conexão. Verificando novamente em 5 segundos...");
            timeoutId = setTimeout(checkStatus, 5000);
          } else {
            setError(`Erro ao verificar pagamento: ${error.message}`);
          }
        } else {
          setError("Erro inesperado ao verificar o status do pagamento.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();

    return () => {
      // Cleanup function to handle component unmount
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setPaymentStatus(null);
      setError(null);
      setIsLoading(false);
    };
  }, [paymentId, onPaymentConfirmed, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-gray-600">Verificando status do pagamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!paymentStatus) {
    return null;
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Status do Pagamento</h3>
      <div className="space-y-2">
        <p>Status: {paymentStatus.status}</p>
        <p>Valor: R$ {(paymentStatus.value / 100).toFixed(2)}</p>
        <p>Tipo: {paymentStatus.billingType}</p>
        <p>Vencimento: {new Date(paymentStatus.dueDate).toLocaleDateString()}</p>
        {paymentStatus.invoiceUrl && (
          <p>
            <a 
              href={paymentStatus.invoiceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Ver comprovante
            </a>
          </p>
        )}
      </div>
    </div>
  );
}; 