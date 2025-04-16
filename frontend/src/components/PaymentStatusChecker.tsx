import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PaymentStatus } from '../types/payment';

interface Props {
  paymentId: string;
  onPaymentConfirmed?: () => void;
}

export function PaymentStatusChecker({ paymentId, onPaymentConfirmed }: Props) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/check-payment-status?paymentId=${paymentId}`);
        const data: PaymentStatus = await response.json();
        
        setPaymentStatus(data);

        if (data.status === 'CONFIRMED') {
          toast.success('Pagamento confirmado com sucesso!', { duration: 5000 });
          onPaymentConfirmed?.();
        } else if (data.status === 'PENDING') {
          toast('Aguardando confirmação do pagamento...', { 
            icon: '⏳',
            duration: 3000 
          });
          
          // Agenda próxima verificação em 5 segundos
          const timeoutId = setTimeout(() => checkPaymentStatus(), 5000);
          return () => clearTimeout(timeoutId);
        } else if (data.status === 'FAILED') {
          toast.error('Falha no processamento do pagamento', { duration: 5000 });
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        toast.error('Erro ao verificar status do pagamento', { duration: 5000 });
      }
    };

    checkPaymentStatus();
  }, [paymentId, onPaymentConfirmed]);

  return null;
} 