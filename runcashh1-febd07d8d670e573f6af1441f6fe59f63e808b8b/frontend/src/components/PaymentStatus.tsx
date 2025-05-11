import { useState, useEffect } from 'react';
import { Loader2, XCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { PaymentStatus as PaymentStatusType } from '@/types/payments';
import Lottie from 'lottie-react';

import paymentSuccessAnimation from '../assets/animations/payment-success.json';
import loadingAnimation from '../assets/animations/loading-circle.json';
import processingAnimation from '../assets/animations/processing-payment.json';
import waitingAnimation from '../assets/animations/waiting-payment.json';
import errorAnimation from '../assets/animations/error-payment.json';

// URL da nova animação de carregamento
const LOADING_ANIMATION_URL = 'https://lottie.host/d56e4d2c-762c-42da-8a8c-34f1fd70c617/TVGDVAZYhW.json';

interface PaymentStatusProps {
  status: PaymentStatusType;
  retry?: () => void;
  goBack?: () => void;
  refreshStatus?: () => void;
  activatedPlan?: string;
  isRefreshing?: boolean;
}

export default function PaymentStatus({
  status,
  retry,
  goBack,
  refreshStatus,
  activatedPlan,
  isRefreshing = false,
}: PaymentStatusProps) {
  const [remoteLoadingAnimation, setRemoteLoadingAnimation] = useState<any>(null);
  
  // Carregar a animação remota
  useEffect(() => {
    const fetchAnimation = async () => {
      try {
        const response = await fetch(LOADING_ANIMATION_URL);
        const animationData = await response.json();
        setRemoteLoadingAnimation(animationData);
      } catch (error) {
        console.error('Erro ao carregar animação:', error);
      }
    };
    
    if (status === 'LOADING') {
      fetchAnimation();
    }
  }, [status]);

  if (status === 'PAYMENT_RECEIVED' || status === 'CONFIRMED' || status === 'RECEIVED') {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-32 h-32">
          <Lottie animationData={paymentSuccessAnimation} loop={false} />
        </div>
        <h3 className="text-2xl font-bold text-green-600">Pagamento confirmado</h3>
        <p className="text-center text-gray-700">
          {activatedPlan ? (
            <>
              Seu plano <strong>{activatedPlan}</strong> foi ativado com sucesso! Agora você já pode
              aproveitar todos os benefícios.
            </>
          ) : (
            'Seu pagamento foi confirmado com sucesso. Obrigado!'
          )}
        </p>
        {goBack && (
          <Button onClick={goBack} className="mt-4">
            Voltar para planos
          </Button>
        )}
      </div>
    );
  }

  if (status === 'PENDING' || status === 'WAITING_PAYMENT') {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-32 h-32">
          <Lottie animationData={waitingAnimation} loop={true} />
        </div>
        <h3 className="text-2xl font-bold text-blue-600">Aguardando pagamento</h3>
        <p className="text-center text-gray-700">
          Estamos aguardando a confirmação do seu pagamento. Isso pode levar alguns instantes.
        </p>
        {refreshStatus && (
          <Button 
            onClick={refreshStatus} 
            className={cn("mt-4", {"opacity-50 cursor-not-allowed": isRefreshing})}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar status'
            )}
          </Button>
        )}
      </div>
    );
  }

  if (status === 'PROCESSING') {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-32 h-32">
          <Lottie animationData={processingAnimation} loop={true} />
        </div>
        <h3 className="text-2xl font-bold text-blue-600">Processando pagamento</h3>
        <p className="text-center text-gray-700">
          Estamos processando seu pagamento. Por favor, aguarde enquanto confirmamos a transação.
        </p>
        {refreshStatus && (
          <Button 
            onClick={refreshStatus} 
            className={cn("mt-4", {"opacity-50 cursor-not-allowed": isRefreshing})} 
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar status'
            )}
          </Button>
        )}
      </div>
    );
  }

  if (status === 'LOADING') {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-32 h-32">
          <Lottie animationData={remoteLoadingAnimation || loadingAnimation} loop={true} />
        </div>
        <h3 className="text-2xl font-bold text-blue-600">Carregando</h3>
        <p className="text-center text-gray-700">
          Por favor, aguarde enquanto carregamos as informações do seu pagamento.
        </p>
      </div>
    );
  }

  // Estado padrão é erro
  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      <div className="w-32 h-32">
        <Lottie animationData={errorAnimation} loop={true} />
      </div>
      <h3 className="text-2xl font-bold text-red-600">Falha no pagamento</h3>
      <p className="text-center text-gray-700">
        {status === 'DECLINED'
          ? 'Seu pagamento foi recusado. Por favor, verifique os dados e tente novamente.'
          : status === 'REFUNDED'
          ? 'Este pagamento foi reembolsado.'
          : status === 'CHARGEBACK'
          ? 'Este pagamento sofreu um chargeback.'
          : 'Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.'}
      </p>
      {retry && (
        <Button onClick={retry} className="mt-4 bg-red-500 hover:bg-red-600">
          Tentar novamente
        </Button>
      )}
      {goBack && (
        <Button onClick={goBack} variant="outline" className="mt-2">
          Voltar para planos
        </Button>
      )}
    </div>
  );
} 