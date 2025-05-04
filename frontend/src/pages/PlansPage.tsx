import { useState, useEffect } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { Check, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Progress } from '@/components/ui/progress';

// Importando os componentes de checkout
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { PaymentSummary } from '@/components/checkout/PaymentSummary';
import { PixPayment } from '@/components/checkout/PixPayment';
import { PaymentStatus } from '@/components/checkout/PaymentStatus';
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

const PlansPage = () => {
  const { availablePlans, currentPlan, loading } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Estados para controle da visualização
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
  // Estados do checkout
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
    qrCodeImage?: string;
    qrCodeText?: string;
    expirationDate?: Date;
  }>({});
  const [paymentStatus, setPaymentStatus] = useState<string>('PENDING');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [checkingInterval, setCheckingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Limpar temporizadores quando o componente é desmontado
  useEffect(() => {
    return () => {
      if (checkingInterval) {
        clearInterval(checkingInterval);
      }
    };
  }, [checkingInterval]);

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

  // Adicionar log para as props que serão passadas para PixPayment
  useEffect(() => {
    if (checkoutState === 'WAITING_PAYMENT') {
      console.log('Valores que serão passados para PixPayment:', {
        qrCodeImage: paymentData.qrCodeImage || '',
        qrCodeText: paymentData.qrCodeText || '',
        paymentStatus,
        expirationTime: timeLeft
      });
    }
  }, [checkoutState, paymentData, paymentStatus, timeLeft]);
  
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
  
  const handleSelectPlan = (planId: string) => {
    // Se já for o plano atual, apenas mostrar mensagem
    if (currentPlan?.id === planId) {
      toast({
        title: "Plano já ativo",
        description: "Você já está inscrito neste plano.",
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive"
      });
      navigate('/login');
      return;
    }
    
    // Encontrar o plano selecionado
    const plan = availablePlans.find(p => p.id === planId);
    if (plan) {
      setSelectedPlan(plan);
      setSelectedPlanId(planId);
      setShowCheckout(true);
      setCheckoutState('FORM_INPUT');
      
      // Inicializar dados do formulário
      setFormData({
        name: user?.username || '',
        email: user?.email || '',
        cpf: '',
        phone: ''
      });
      
      // Limpar dados anteriores
      setError(null);
      setPaymentData({});
      setPaymentStatus('PENDING');
      
      // Scroll para o topo
      window.scrollTo(0, 0);
    } else {
      toast({
        title: 'Plano não encontrado',
        description: 'O plano selecionado não está disponível.',
        variant: 'destructive'
      });
    }
  };

  // Carregar QR code PIX
  const loadPixQrCode = async () => {
    if (!paymentData.paymentId) return;
    
    setIsRefreshing(true);
    setError(null);
    
    try {
      console.log('Carregando QR code PIX para o pagamento:', paymentData.paymentId);
      const pixData = await getAsaasPixQrCode(paymentData.paymentId);
      
      console.log('Dados recebidos da API getAsaasPixQrCode:', 
        pixData.qrCodeImage ? 
          { ...pixData, qrCodeImage: `${pixData.qrCodeImage.substring(0, 30)}... (${pixData.qrCodeImage.length} chars)` } : 
          pixData
      );
      
      if (!pixData.qrCodeImage || !pixData.qrCodeText) {
        console.error('QR Code PIX não disponível na resposta:', pixData);
        setError('QR Code PIX não disponível. Tente novamente em alguns segundos.');
        // Tentar novamente após 3 segundos
        setTimeout(() => loadPixQrCode(), 3000);
        return;
      }
      
      if (pixData.qrCodeImage.length < 100) {
        console.warn('QR Code PIX possivelmente incompleto ou inválido. Tamanho:', pixData.qrCodeImage.length);
      }
      
      // Atualiza o estado com os dados recebidos
      const updatedPaymentData = {
        ...paymentData,
        qrCodeImage: pixData.qrCodeImage,
        qrCodeText: pixData.qrCodeText,
        expirationDate: pixData.expirationDate ? new Date(pixData.expirationDate) : undefined
      };
      
      console.log('Dados salvos no estado paymentData:', 
        { ...updatedPaymentData, qrCodeImage: updatedPaymentData.qrCodeImage ? 
          `${updatedPaymentData.qrCodeImage.substring(0, 30)}... (${updatedPaymentData.qrCodeImage.length} chars)` : 
          'undefined' 
        }
      );
      
      setPaymentData(updatedPaymentData);
      setIsRefreshing(false);
    } catch (error) {
      setIsRefreshing(false);
      console.error('Erro ao carregar QR Code PIX:', error);
      setError('Não foi possível carregar o QR Code PIX. Tente recarregar a página.');
    }
  };

  // Verificar status do pagamento
  const checkPaymentStatus = async (force: boolean = false) => {
    if (!paymentData.paymentId) return;
    
    try {
      console.log('Verificando status do pagamento:', paymentData.paymentId, force ? '(verificação forçada)' : '');
      
      // Se for verificação forçada, mostrar indicador de carregamento
      if (force) {
        setIsRefreshing(true);
      }
      
      // Buscar o status atualizado do pagamento
      const payment = await findAsaasPayment(paymentData.paymentId, force);
      
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
        
        // Redirecionar para página de sucesso após 2 segundos
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
      
      // Verificar se a resposta já contém o QR code
      const qrCodeFromResponse = subscription.qrCode;
      
      // Atualizar dados de pagamento
      setPaymentData({
        subscriptionId: subscription.subscriptionId,
        paymentId: subscription.paymentId,
        // Se o QR code já estiver na resposta, usá-lo diretamente
        ...(qrCodeFromResponse && {
          qrCodeImage: qrCodeFromResponse.encodedImage,
          qrCodeText: qrCodeFromResponse.payload,
          expirationDate: qrCodeFromResponse.expirationDate ? new Date(qrCodeFromResponse.expirationDate) : undefined
        })
      });
      
      // Log para depuração
      console.log('QR code na resposta da assinatura:', qrCodeFromResponse ? 'Presente' : 'Ausente');
      
      // Se for plano gratuito, concluir diretamente
      if (selectedPlan.id === 'free') {
        toast({
          title: "Plano ativado com sucesso!",
          description: "Seu plano foi ativado com sucesso.",
        });
        navigate('/payment-success');
      } else if (subscription.paymentId) {
        // Carregar QR code e configurar verificação periódica
        setCheckoutState('WAITING_PAYMENT');
        
        // Carregar QR Code PIX
        setTimeout(() => {
          loadPixQrCode();
        }, 500);
        
        // Configurar verificação periódica do status do pagamento
        const interval = setInterval(() => {
          checkPaymentStatus();
        }, 5000);
        
        setCheckingInterval(interval);
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
    setShowCheckout(false);
    setSelectedPlanId(null);
    
    // Limpar temporizadores
    if (checkingInterval) {
      clearInterval(checkingInterval);
      setCheckingInterval(null);
    }
  };

  const handleRetry = () => {
    if (checkoutState === 'WAITING_PAYMENT') {
      // Recomeçar no modo PIX
      loadPixQrCode();
    } else {
      // Voltar para o formulário
      setCheckoutState('FORM_INPUT');
      setError(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  // Filtrar apenas os planos Profissional (49,90) e Premium (99,90)
  const filteredPlans = availablePlans
    .filter(plan => (plan.price === 49.90 || plan.price === 99.90) && plan.interval === 'monthly');

  return (
    <Layout>
      <div className="container py-8 space-y-8">
        {showCheckout ? (
          <div className="max-w-6xl mx-auto">
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
                    qrCodeImage={paymentData.qrCodeImage || ''}
                    qrCodeText={paymentData.qrCodeText || ''}
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
        ) : (
          <>
        <h1 className="text-3xl font-bold text-center mb-2">Escolha o plano ideal para você</h1>
        <p className="text-gray-400 text-center mb-10">
          Assine e tenha acesso a todos os recursos da plataforma.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {filteredPlans.map(plan => (
            <div 
              key={plan.id}
              className={`border rounded-lg p-6 flex flex-col ${
                currentPlan?.id === plan.id 
                  ? 'border-vegas-gold bg-vegas-black/60 relative overflow-hidden' 
                  : plan.id === 'pro' 
                    ? 'border-vegas-gold bg-vegas-black/60 relative overflow-hidden' 
                    : 'border-gray-700 bg-vegas-black/40'
              }`}
            >
              {plan.id === 'pro' && (
                <div className="absolute right-0 top-0 bg-vegas-gold text-black text-xs px-4 py-1 transform translate-x-2 translate-y-3 rotate-45">
                  Popular
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                {currentPlan?.id === plan.id && (
                  <span className="bg-vegas-gold text-black text-xs px-2 py-1 rounded-full">
                    Plano Atual
                  </span>
                )}
              </div>
              
              <div className="mt-4 mb-2">
                <span className="text-3xl font-bold">
                  R$ {plan.price.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400">
                  /mês
                </span>
              </div>
              
              <p className="text-gray-400 text-sm mb-6">{plan.description}</p>
              
              <ul className="space-y-3 mb-6 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <Check className="h-5 w-5 text-vegas-gold mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                onClick={() => handleSelectPlan(plan.id)}
                className={
                  currentPlan?.id === plan.id 
                    ? "bg-gray-700 hover:bg-gray-600" 
                    : plan.id === 'pro'
                      ? "bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                      : "bg-vegas-gold/80 hover:bg-vegas-gold text-black"
                }
                disabled={currentPlan?.id === plan.id}
              >
                {currentPlan?.id === plan.id 
                  ? "Plano Atual" 
                  : "Assinar Agora"}
              </Button>
            </div>
          ))}
        </div>
        
        <div className="mt-12 bg-vegas-black/30 p-6 rounded-lg border border-gray-800 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4">Dúvidas Frequentes</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Como funciona o sistema de assinatura?</h3>
              <p className="text-sm text-gray-400">
                Nossas assinaturas são cobradas mensalmente e o pagamento é processado via PIX através da plataforma Asaas.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Posso cancelar a qualquer momento?</h3>
              <p className="text-sm text-gray-400">
                Sim, você pode cancelar sua assinatura a qualquer momento. O acesso aos recursos premium permanecerá ativo até o final do período pago.
              </p>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default PlansPage; 