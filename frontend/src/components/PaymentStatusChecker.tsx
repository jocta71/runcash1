import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { checkPaymentStatus } from '../integrations/asaas/client';

interface PaymentStatusCheckerProps {
  paymentId: string;
  onPaymentConfirmed: (payment: any) => void;
  onError?: (error: Error) => void;
  checkInterval?: number;
  maxTimeout?: number;
}

/**
 * Componente para verificar o status de um pagamento no Asaas
 */
const PaymentStatusChecker: React.FC<PaymentStatusCheckerProps> = ({
  paymentId,
  onPaymentConfirmed,
  onError,
  checkInterval = 5000,
  maxTimeout = 10 * 60 * 1000,
}) => {
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setStatus('error');
      setErrorMessage('ID de pagamento não fornecido');
      return;
    }

    const stopChecking = checkPaymentStatus(
      paymentId,
      (payment) => {
        setStatus('confirmed');
        if (onPaymentConfirmed) {
          onPaymentConfirmed(payment);
        }
      },
      (error) => {
        setStatus('error');
        setErrorMessage(error.message);
        if (onError) {
          onError(error);
        }
      },
      checkInterval,
      maxTimeout
    );

    // Limpa o verificador quando o componente for desmontado
    return () => {
      stopChecking();
    };
  }, [paymentId, onPaymentConfirmed, onError, checkInterval, maxTimeout]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, my: 2 }}>
      {status === 'checking' && (
        <>
          <CircularProgress size={32} />
          <Typography variant="body1">
            Verificando status do pagamento...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aguarde enquanto confirmamos seu pagamento
          </Typography>
        </>
      )}

      {status === 'confirmed' && (
        <Alert severity="success">
          Pagamento confirmado com sucesso!
        </Alert>
      )}

      {status === 'error' && (
        <Alert severity="error">
          {errorMessage || 'Erro ao processar pagamento'}
        </Alert>
      )}
    </Box>
  );
};

export default PaymentStatusChecker; 