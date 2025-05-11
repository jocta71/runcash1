import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { PaymentSummary } from '@/components/checkout/PaymentSummary';
import { PixPayment } from '@/components/checkout/PixPayment';
import { PaymentStatus } from '@/components/checkout/PaymentStatus';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  createAsaasSubscription,
  findAsaasPayment,
  getAsaasPixQrCode 
} from '@/integrations/asaas/client';

// Tipos de estado do checkout
type CheckoutState =
  | 'FORM_INPUT'
  | 'VALIDATING'
  | 'PROCESSING_PAYMENT'
  | 'WAITING_PAYMENT'
  | 'PAYMENT_RECEIVED'
  | 'ERROR';

const CheckoutPage = () => {
  const { planId: routePlanId } = useParams<{ planId: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryPlanId = queryParams.get('planId');
  const customerId = queryParams.get('customerId');
  const paymentId = queryParams.get('paymentId');
  
  // Determinar qual planId usar (da rota ou da query string)
  const planId = routePlanId || queryPlanId;
  
  const { user } = useAuth();
  const { availablePlans, loading } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('FORM_INPUT');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [progress, setProgress] = useState(25);
  const [formData, setFormData] = useState({
    name: user?.username || '',
    email: user?.email || '',
    cpf: '',
    phone: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Estados para pagamento PIX
  const [paymentData, setPaymentData] = useState<{
    subscriptionId?: string;
    paymentId?: string;
    pixCodeImage?: string;
    pixCodeText?: string;
    expirationDate?: Date;
  }>({});
  const [paymentStatus, setPaymentStatus] = useState<string>('PENDING');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [checkingInterval, setCheckingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Determinar se estamos no modo de formulário ou de pagamento PIX
  const isPixPaymentMode = !!(customerId && paymentId);

  // Atualizar progresso com base no estado
  useEffect(() => {
    switch (checkoutState) {
      case 'FORM_INPUT':
        setProgress(25);
        break;
      case 'VALIDATING':
      case 'PROCESSING_PAYMENT':
        setProgress(50);
        break;
      case 'WAITING_PAYMENT':
        setProgress(75);
        break;
      case 'PAYMENT_RECEIVED':
        setProgress(100);
        break;
      case 'ERROR':
        // Manter o progresso atual
        break;
    }
  }, [checkoutState]);
  
  // Carregar plano selecionado
  useEffect(() => {
    if (!loading && availablePlans && planId) {
      const plan = availablePlans.find(p => p.id === planId);
      if (plan) {
        setSelectedPlan(plan);
      } else {
        toast({
          title: 'Plano não encontrado',
          description: 'O plano selecionado não está disponível.',
          variant: 'destructive'
        });
        navigate('/planos');
      }
    }
  }, [loading, availablePlans, planId, navigate, toast]);

  // Carregar QR code PIX quando no modo de pagamento PIX
  useEffect(() => {
    if (isPixPaymentMode && paymentId) {
      setCheckoutState('WAITING_PAYMENT');
      loadPixQrCode();
      
      // Configurar verificação periódica do status do pagamento
      const interval = setInterval(() => {
        checkPaymentStatus();
      }, 5000);
      
      setCheckingInterval(interval);
      
      // Limpar intervalo quando o componente for desmontado
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [isPixPaymentMode, paymentId]);

  // Calcular tempo restante para pagamento
  useEffect(() => {
    if (!paymentData.expirationDate) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = paymentData.expirationDate!.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft('Expirado');
        return;
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [paymentData.expirationDate]);

  // Carregar QR code PIX
  const loadPixQrCode = async () => {
    if (!paymentId) return;
    
    setIsRefreshing(true);
    setError(null);
    
    try {
      console.log('Carregando QR code PIX para o pagamento:', paymentId);
      const pixData = await getAsaasPixQrCode(paymentId);
      
      if (!pixData.qrCodeImage || !pixData.qrCodeText) {
        setError('QR Code PIX não disponível. Tente novamente em alguns segundos.');
        // Tentar novamente após 3 segundos
        setTimeout(() => loadPixQrCode(), 3000);
        return;
      }
      
      setPaymentData({
        paymentId,
        pixCodeImage: pixData.qrCodeImage,
        pixCodeText: pixData.qrCodeText,
        expirationDate: pixData.expirationDate ? new Date(pixData.expirationDate) : undefined
      });
      
      setIsRefreshing(false);
    } catch (error) {
      setIsRefreshing(false);
      setError('Não foi possível carregar o QR Code PIX. Tente recarregar a página.');
      console.error('Erro ao carregar QR Code PIX:', error);
    }
  };

  // Verificar status do pagamento
  const checkPaymentStatus = async (force: boolean = false) => {
    if (!paymentId) return;
    
    try {
      console.log('Verificando status do pagamento:', paymentId, force ? '(verificação forçada)' : '');
      
      // Se for verificação forçada, mostrar indicador de carregamento
      if (force) {
        setIsRefreshing(true);
      }
      
      // Buscar o status atualizado do pagamento
      const payment = await findAsaasPayment(paymentId, force);
      
      console.log('Status do pagamento:', payment.status);
      setPaymentStatus(payment.status);
      
      // Desativar indicador de carregamento após verificação forçada
      if (force) {
        setIsRefreshing(false);
        
        // Mostrar status atual ao usuário
        toast({
          title: `Status do pagamento: ${payment.status}`,
          description: getPaymentStatusDescription(payment.status),
        });
      }
      
      // Se o pagamento foi confirmado
      if (payment && (
        payment.status === 'RECEIVED' || 
        payment.status === 'CONFIRMED' || 
        payment.status === 'AVAILABLE' ||
        payment.status === 'BILLING_AVAILABLE'
      )) {
        console.log('Pagamento confirmado!', payment);
        
        // Parar o checking
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        // Atualizar estado
        setCheckoutState('PAYMENT_RECEIVED');
        
        // Mostrar toast de sucesso
        toast({
          title: "Pagamento confirmado!",
          description: "Seu pagamento foi confirmado com sucesso!",
        });
        
        // Redirecionar para página de sucesso
        setTimeout(() => {
          navigate('/payment-success');
        }, 2000);
      } else if (payment && (
        payment.status === 'OVERDUE' || 
        payment.status === 'CANCELED' || 
        payment.status === 'REFUNDED' ||
        payment.status === 'REFUND_REQUESTED'
      )) {
        console.log('Pagamento com problema:', payment.status);
        
        // Parar o checking
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        // Atualizar estado
        setCheckoutState('ERROR');
        
        // Mostrar erro
        setError(`Pagamento ${
          payment.status === 'OVERDUE' ? 'expirado' : 
          payment.status === 'CANCELED' ? 'cancelado' : 
          'estornado ou em processo de estorno'
        }. Por favor, tente novamente.`);
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      
      // Se for verificação forçada, desabilitar carregamento e mostrar erro
      if (force) {
        setIsRefreshing(false);
        toast({
          variant: "destructive",
          title: "Erro na verificação",
          description: "Não foi possível verificar o status do pagamento. Tente novamente.",
        });
      }
    }
  };

  // Obter descrição do status de pagamento
  const getPaymentStatusDescription = (status: string): string => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED':
      case 'AVAILABLE':
      case 'BILLING_AVAILABLE':
        return 'Pagamento confirmado com sucesso!';
      case 'PENDING':
        return 'Pagamento pendente. Aguardando confirmação do banco.';
      case 'OVERDUE':
        return 'Pagamento expirado. Por favor, gere um novo QR code.';
      case 'CANCELED':
        return 'Pagamento cancelado.';
      case 'REFUNDED':
      case 'REFUND_REQUESTED':
        return 'Pagamento estornado ou em processo de estorno.';
      default:
        return `Status do pagamento: ${status}`;
    }
  };

  // Processar envio do formulário
  const handleFormSubmit = async (data: any) => {
    setError(null);
    setIsSubmitting(true);
    setCheckoutState('VALIDATING');
    
    // Guardar dados do formulário
    setFormData(data);
    
    try {
      // Verificação do usuário
      if (!user) {
        throw new Error("Você precisa estar logado para assinar um plano.");
      }
      
      if (!selectedPlan) {
        throw new Error("Nenhum plano selecionado.");
      }
      
      // Atualizar estado
      setCheckoutState('PROCESSING_PAYMENT');
      
      // Validação simples de CPF (remover formatação e verificar tamanho)
      const cpfClean = data.cpf.replace(/\D/g, '');
      if (cpfClean.length !== 11) {
        throw new Error("Por favor, insira um CPF válido com 11 dígitos.");
      }
      
      if (!user.asaasCustomerId) {
        throw new Error("Não foi possível identificar seu cadastro de cliente. Por favor, tente novamente ou entre em contato com o suporte.");
      }
      
      // Criar assinatura passando o CPF para atualização
      console.log('Criando assinatura para o cliente...');
      const subscription = await createAsaasSubscription(
        selectedPlan.id, 
        user.id,
        user.asaasCustomerId,
        'PIX',
        undefined,
        undefined,
        cpfClean
      );
      
      console.log('Assinatura criada:', subscription);
      
      // Atualizar dados de pagamento
      setPaymentData({
        subscriptionId: subscription.subscriptionId,
        paymentId: subscription.paymentId
      });
      
      // Se for plano gratuito, concluir diretamente
      if (selectedPlan.id === 'free') {
        toast({
          title: "Plano ativado com sucesso!",
          description: "Seu plano foi ativado com sucesso.",
        });
        navigate('/payment-success');
      } else if (subscription.paymentId) {
        // Para qualquer plano pago, sempre redirecionar para página de pagamento PIX
        window.location.href = `/pagamento?planId=${selectedPlan.id}&customerId=${user.asaasCustomerId}&paymentId=${subscription.paymentId}`;
      } else {
        throw new Error("Não foi possível obter as informações de pagamento. Por favor, tente novamente.");
      }
    } catch (error) {
      console.error('Erro no processo de assinatura:', error);
      
      setCheckoutState('ERROR');
      
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Ocorreu um erro inesperado ao processar sua assinatura. Por favor, tente novamente.");
      }
      
      toast({
        variant: "destructive",
        title: "Erro na assinatura",
        description: "Não foi possível processar sua assinatura. Por favor, tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manipuladores de eventos
  const handleRefreshStatus = async () => {
    await checkPaymentStatus(true);
  };

  const handleCancel = () => {
    navigate('/planos');
  };

  const handleRetry = () => {
    if (isPixPaymentMode) {
      // Recomeçar no modo PIX
      loadPixQrCode();
      setCheckoutState('WAITING_PAYMENT');
    } else {
      // Voltar para o formulário
      setCheckoutState('FORM_INPUT');
      setError(null);
    }
  };

  // Redirecionamento se não houver usuário autenticado
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto pt-8 pb-16 px-4">
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">É necessário fazer login</h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>Você precisa estar logado para acessar esta página. Clique no botão abaixo para fazer login.</p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <Button
                    onClick={() => navigate('/auth')}
                    className="bg-amber-100 px-2 py-1.5 rounded-md text-amber-800 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-amber-50 focus:ring-amber-600"
                  >
                    Fazer Login
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading || (!selectedPlan && !isPixPaymentMode)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-16 px-4">
      {/* Barra de progresso */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-0"
            onClick={handleCancel}
            disabled={isSubmitting || checkoutState === 'PROCESSING_PAYMENT'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para planos
          </Button>
          
          <div className="text-sm font-medium">
            {checkoutState === 'FORM_INPUT' && 'Informações pessoais'}
            {checkoutState === 'VALIDATING' && 'Validando dados'}
            {checkoutState === 'PROCESSING_PAYMENT' && 'Processando pagamento'}
            {checkoutState === 'WAITING_PAYMENT' && 'Aguardando pagamento'}
            {checkoutState === 'PAYMENT_RECEIVED' && 'Pagamento concluído'}
            {checkoutState === 'ERROR' && 'Erro no pagamento'}
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      {error && checkoutState === 'ERROR' && (
        <div className="mb-6">
          <PaymentStatus status="ERROR" message={error} />
          <div className="mt-4 flex justify-center">
            <Button onClick={handleRetry} className="mx-2">
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={handleCancel} className="mx-2">
              Cancelar
            </Button>
          </div>
        </div>
      )}
      
      {/* Layout principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna com formulário ou pagamento PIX */}
        <div className="md:col-span-2">
          {(checkoutState === 'FORM_INPUT' || checkoutState === 'VALIDATING') && (
            <CheckoutForm
              defaultValues={formData}
              onSubmit={handleFormSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
            />
          )}
          
          {(checkoutState === 'WAITING_PAYMENT' || checkoutState === 'PAYMENT_RECEIVED') && (
            <PixPayment
              qrCodeImage={paymentData.pixCodeImage || ''}
              qrCodeText={paymentData.pixCodeText || ''}
              paymentStatus={paymentStatus}
              expirationTime={timeLeft}
              onRefreshStatus={handleRefreshStatus}
              isRefreshing={isRefreshing}
            />
          )}
          
          {checkoutState === 'PROCESSING_PAYMENT' && (
            <div className="flex flex-col items-center justify-center p-12 border rounded-lg">
              <Loader2 className="h-10 w-10 animate-spin mb-4" />
              <h3 className="text-lg font-medium mb-2">Processando seu pagamento</h3>
              <p className="text-gray-500 text-center">
                Estamos preparando seu pagamento. Por favor, aguarde um momento...
              </p>
            </div>
          )}
        </div>
        
        {/* Coluna com resumo do plano */}
        <div className="md:col-span-1">
          {selectedPlan && <PaymentSummary plan={selectedPlan} />}
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage; 