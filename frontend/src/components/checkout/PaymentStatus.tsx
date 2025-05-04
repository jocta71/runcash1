import { CheckCircle, XCircle, Clock, AlertTriangle, CircleDollarSign, Award, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import Lottie from 'lottie-react';

interface PaymentStatusProps {
  status: string;
  message?: string;
}

// Importar e definir a nova URL da animação de carregamento
const LOADING_ANIMATION_URL = 'https://lottie.host/d56e4d2c-762c-42da-8a8c-34f1fd70c617/TVGDVAZYhW.json';

export function PaymentStatus({ status, message }: PaymentStatusProps) {
  const [remoteLoadingAnimation, setRemoteLoadingAnimation] = useState<any>(null);

  useEffect(() => {
    if (status === 'LOADING' || 
        status === 'PENDING' || 
        status === 'AWAITING_PAYMENT' || 
        status === 'PROCESSING' || 
        status === 'AWAITING_CONFIRMATION' || 
        status === 'WAITING_FOR_BANK_CONFIRMATION') {
      const fetchAnimation = async () => {
        try {
          const response = await fetch(LOADING_ANIMATION_URL);
          const animationData = await response.json();
          setRemoteLoadingAnimation(animationData);
        } catch (error) {
          console.error('Erro ao carregar animação:', error);
        }
      };
      fetchAnimation();
    }
  }, [status]);

  // Se o status for UM DOS ESTADOS DE PROCESSAMENTO/ESPERA, mostrar a animação 
  if (status === 'PENDING' || 
      status === 'AWAITING_PAYMENT' || 
      status === 'PROCESSING' || 
      status === 'AWAITING_CONFIRMATION' || 
      status === 'WAITING_FOR_BANK_CONFIRMATION') {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-24 h-24 mb-4">
          {remoteLoadingAnimation ? (
            <Lottie animationData={remoteLoadingAnimation} loop={true} />
          ) : (
            <RotateCw className="h-8 w-8 animate-spin" />
          )}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium">
            {status === 'PENDING' || status === 'AWAITING_PAYMENT' 
              ? "Aguardando pagamento" 
              : "Processando pagamento"}
          </h3>
          <p className="text-sm text-gray-500">
            {message || (
              status === 'PENDING' || status === 'AWAITING_PAYMENT'
                ? "Estamos aguardando a confirmação do seu pagamento."
                : "Aguarde enquanto processamos seu pagamento."
            )}
          </p>
        </div>
      </div>
    );
  }
  
  // Se o status for LOADING, mostrar a animação
  if (status === 'LOADING') {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-24 h-24 mb-4">
          {remoteLoadingAnimation ? (
            <Lottie animationData={remoteLoadingAnimation} loop={true} />
          ) : (
            <RotateCw className="h-8 w-8 animate-spin" />
          )}
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium">Carregando</h3>
          <p className="text-sm text-gray-500">{message || "Aguarde um momento..."}</p>
        </div>
      </div>
    );
  }

  // Define status configurations
  const statusConfig = {
    // Status de carregamento
    LOADING: {
      icon: <RotateCw className="h-5 w-5 animate-spin" />,
      title: "Carregando",
      description: message || "Aguarde um momento enquanto carregamos as informações.",
      variant: "default" as const,
    },
    
    // Status de espera/pendente
    PENDING: {
      icon: <Clock className="h-5 w-5" />,
      title: "Aguardando pagamento",
      description: message || "Estamos aguardando a confirmação do seu pagamento via PIX.",
      variant: "default" as const,
    },
    AWAITING_PAYMENT: {
      icon: <Clock className="h-5 w-5" />,
      title: "Aguardando pagamento",
      description: message || "Por favor, escaneie o QR code para finalizar seu pagamento.",
      variant: "default" as const,
    },
    AWAITING_CONFIRMATION: {
      icon: <RotateCw className="h-5 w-5" />,
      title: "Processando pagamento",
      description: message || "Seu pagamento foi realizado e está sendo processado.",
      variant: "default" as const,
    },
    WAITING_FOR_BANK_CONFIRMATION: {
      icon: <RotateCw className="h-5 w-5" />,
      title: "Aguardando banco",
      description: message || "Estamos aguardando a confirmação da sua instituição financeira.",
      variant: "default" as const,
    },
    PROCESSING: {
      icon: <RotateCw className="h-5 w-5" />,
      title: "Processando pagamento",
      description: message || "Seu pagamento está sendo processado pelo sistema.",
      variant: "default" as const,
    },
    
    // Status de sucesso
    RECEIVED: {
      icon: <CheckCircle className="h-5 w-5" />,
      title: "Pagamento recebido",
      description: message || "Seu pagamento foi recebido com sucesso!",
      variant: "success" as const,
    },
    CONFIRMED: {
      icon: <CheckCircle className="h-5 w-5" />,
      title: "Pagamento confirmado",
      description: message || "Seu pagamento foi confirmado com sucesso!",
      variant: "success" as const,
    },
    AVAILABLE: {
      icon: <CheckCircle className="h-5 w-5" />,
      title: "Pagamento confirmado",
      description: message || "Seu pagamento foi confirmado e está disponível!",
      variant: "success" as const,
    },
    BILLING_AVAILABLE: {
      icon: <Award className="h-5 w-5" />,
      title: "Assinatura ativada",
      description: message || "Sua assinatura foi ativada com sucesso!",
      variant: "success" as const,
    },
    APPROVED: {
      icon: <CheckCircle className="h-5 w-5" />,
      title: "Pagamento aprovado",
      description: message || "Seu pagamento foi aprovado com sucesso!",
      variant: "success" as const,
    },
    PAID: {
      icon: <CircleDollarSign className="h-5 w-5" />,
      title: "Pagamento concluído",
      description: message || "Pagamento realizado com sucesso!",
      variant: "success" as const,
    },
    
    // Status de erro/problemas
    OVERDUE: {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: "Pagamento expirado",
      description: message || "O prazo para pagamento expirou. Por favor, gere um novo QR code.",
      variant: "warning" as const,
    },
    EXPIRED: {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: "QR Code expirado",
      description: message || "O QR code expirou. Por favor, gere um novo para continuar.",
      variant: "warning" as const,
    },
    CANCELED: {
      icon: <XCircle className="h-5 w-5" />,
      title: "Pagamento cancelado",
      description: message || "Este pagamento foi cancelado.",
      variant: "destructive" as const,
    },
    DECLINED: {
      icon: <XCircle className="h-5 w-5" />,
      title: "Pagamento recusado",
      description: message || "Seu pagamento foi recusado pela instituição financeira.",
      variant: "destructive" as const,
    },
    FAILED: {
      icon: <XCircle className="h-5 w-5" />,
      title: "Falha no pagamento",
      description: message || "Ocorreu uma falha ao processar seu pagamento.",
      variant: "destructive" as const,
    },
    REFUNDED: {
      icon: <XCircle className="h-5 w-5" />,
      title: "Pagamento estornado",
      description: message || "Este pagamento foi estornado.",
      variant: "destructive" as const,
    },
    REFUND_REQUESTED: {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: "Estorno solicitado",
      description: message || "Foi solicitado o estorno deste pagamento.",
      variant: "warning" as const,
    },
    ERROR: {
      icon: <XCircle className="h-5 w-5" />,
      title: "Erro no pagamento",
      description: message || "Ocorreu um erro ao processar seu pagamento.",
      variant: "destructive" as const,
    },
  };

  // Get config for current status or use default
  const config = statusConfig[status as keyof typeof statusConfig] || {
    icon: <AlertTriangle className="h-5 w-5" />,
    title: `Status: ${status}`,
    description: message || "Não foi possível determinar o status do pagamento.",
    variant: "default" as const,
  };

  // Custom styling based on variant
  const variantStyles = {
    default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
    success: "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    warning: "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
    destructive: "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300",
  };

  return (
    <Alert className={variantStyles[config.variant]}>
      <div className="flex items-start">
        <div className="mr-3 mt-0.5">{config.icon}</div>
        <div>
          <AlertTitle className="mb-1">{config.title}</AlertTitle>
          <AlertDescription>{config.description}</AlertDescription>
        </div>
      </div>
    </Alert>
  );
} 