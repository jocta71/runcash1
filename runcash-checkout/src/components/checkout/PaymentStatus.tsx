import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface PaymentStatusProps {
  status: string
  message?: string
}

export function PaymentStatus({ status, message }: PaymentStatusProps) {
  // Define status configurations
  const statusConfig = {
    PENDING: {
      icon: <Clock className="h-5 w-5" />,
      title: "Aguardando pagamento",
      description: message || "Estamos aguardando a confirmação do seu pagamento.",
      variant: "default" as const,
    },
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
    OVERDUE: {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: "Pagamento atrasado",
      description: message || "O prazo para pagamento expirou.",
      variant: "warning" as const,
    },
    CANCELED: {
      icon: <XCircle className="h-5 w-5" />,
      title: "Pagamento cancelado",
      description: message || "Este pagamento foi cancelado.",
      variant: "destructive" as const,
    },
    ERROR: {
      icon: <XCircle className="h-5 w-5" />,
      title: "Erro no pagamento",
      description: message || "Ocorreu um erro ao processar seu pagamento.",
      variant: "destructive" as const,
    },
  }

  // Get config for current status or use default
  const config = statusConfig[status as keyof typeof statusConfig] || {
    icon: <AlertTriangle className="h-5 w-5" />,
    title: "Status desconhecido",
    description: message || "Não foi possível determinar o status do pagamento.",
    variant: "default" as const,
  }

  // Custom styling based on variant
  const variantStyles = {
    default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
    success: "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    warning: "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
    destructive: "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300",
  }

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
  )
}
