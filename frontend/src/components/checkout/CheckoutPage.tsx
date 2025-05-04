import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { createAsaasSubscription, findAsaasPayment, getAsaasPixQrCode } from '@/integrations/asaas/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ArrowLeft } from 'lucide-react';

// Componentes de UI
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Componentes personalizados
import { PlanCard } from './PlanCard';
import { PersonalInfoForm } from './PersonalInfoForm';
import { SubscriptionSummary } from './SubscriptionSummary';
import { PixPaymentCard } from './PixPaymentCard';

// Formatadores de CPF e telefone
const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
};

const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
};

// Estados da máquina de estados do checkout
type CheckoutState = 
  | 'PLAN_SELECTION' 
  | 'FORM_INPUT' 
  | 'PROCESSING' 
  | 'PAYMENT_PENDING' 
  | 'PAYMENT_SUCCESS' 
  | 'ERROR';

// Componente de Checkout
const CheckoutPage = () => {
  // Hooks de roteamento e contexto
  const { planId: routePlanId } = useParams<{ planId: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryPlanId = queryParams.get('planId');
  const customerId = queryParams.get('customerId');
  const paymentId = queryParams.get('paymentId');
  const navigate = useNavigate();
  
  // Hooks de contexto
  const { user } = useAuth();
  const { availablePlans, loading: plansLoading } = useSubscription();
  const { toast } = useToast();
  
  // Determinar qual planId usar (da rota ou da query string)
  const planId = routePlanId || queryPlanId;
  
  // Estados do componente
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>(
    paymentId ? 'PAYMENT_PENDING' : planId ? 'FORM_INPUT' : 'PLAN_SELECTION'
  );
  const [formData, setFormData] = useState({
    name: user?.username || '',
    email: user?.email || '',
    cpf: '',
    phone: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para o QR code PIX
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCodeText, setQrCodeText] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [checkingInterval, setCheckingInterval] = useState<NodeJS.Timeout | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(100);
  
  // Efeito para carregar o plano selecionado
  useEffect(() => {
    if (!plansLoading && availablePlans && planId) {
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
  }, [plansLoading, availablePlans, planId, navigate, toast]);
  
  // Efeito para atualizar os dados do formulário com informações do usuário
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.username || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);
  
  // Efeito para carregar o QR code PIX quando estiver no modo de pagamento PIX
  useEffect(() => {
    if (checkoutState === 'PAYMENT_PENDING' && paymentId) {
      loadPixQrCode();
      
      // Configurar verificação periódica do status do pagamento
      const interval = setInterval(() => {
        checkPaymentStatus();
      }, 5000); // Verificar a cada 5 segundos
      
      setCheckingInterval(interval);
      
      // Iniciar temporizador visual (10 minutos)
      let timeLeft = 100;
      const timer = setInterval(() => {
        timeLeft -= 0.1667; // Decrementar aproximadamente 0.167% a cada segundo (100% em 10 minutos)
        setTimeRemaining(Math.max(0, timeLeft));
        if (timeLeft <= 0) {
          clearInterval(timer);
        }
      }, 1000);
      
      // Limpar intervalos quando o componente for desmontado
      return () => {
        if (interval) clearInterval(interval);
        clearInterval(timer);
      };
    }
  }, [checkoutState, paymentId]);
  
  // Carregar QR code PIX
  const loadPixQrCode = async () => {
    if (!paymentId) return;
    
    setPixLoading(true);
    setPixError(null);
    
    try {
      console.log('Carregando QR code PIX para o pagamento:', paymentId);
      const pixData = await getAsaasPixQrCode(paymentId);
      
      if (!pixData.qrCodeImage || !pixData.qrCodeText) {
        setPixError('QR Code PIX não disponível. Tente novamente em alguns segundos.');
        // Tentar novamente após 3 segundos
        setTimeout(() => loadPixQrCode(), 3000);
        return;
      }
      
      setQrCodeImage(pixData.qrCodeImage);
      setQrCodeText(pixData.qrCodeText);
      setExpirationDate(pixData.expirationDate || null);
      
      setPixLoading(false);
    } catch (error) {
      setPixLoading(false);
      setPixError('Não foi possível carregar o QR Code PIX. Tente recarregar a página.');
      console.error('Erro ao carregar QR Code PIX:', error);
    }
  };
  
  // Verificar status do pagamento
  const checkPaymentStatus = async (force: boolean = false) => {
    if (!paymentId) return;
    
    try {
      if (force) {
        setPixLoading(true);
      }
      
      const payment = await findAsaasPayment(paymentId, force);
      setPaymentStatus(payment.status);
      
      if (force) {
        setPixLoading(false);
        toast({
          title: `Status do pagamento: ${payment.status}`,
          description: getPaymentStatusDescription(payment.status),
        });
      }
      
      // Verificar se o pagamento foi confirmado
      if (payment && ['RECEIVED', 'CONFIRMED', 'AVAILABLE', 'BILLING_AVAILABLE'].includes(payment.status)) {
        // Parar a verificação periódica
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        setCheckoutState('PAYMENT_SUCCESS');
        
        toast({
          title: "Pagamento confirmado!",
          description: "Seu pagamento foi confirmado com sucesso!",
        });
        
        // Redirecionar para página de sucesso após 2 segundos
        setTimeout(() => {
          navigate('/payment-success');
        }, 2000);
      } else if (payment && ['OVERDUE', 'CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(payment.status)) {
        // Pagamento com problema
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        setCheckoutState('ERROR');
        setPixError(`Pagamento ${
          payment.status === 'OVERDUE' ? 'expirado' : 
          payment.status === 'CANCELED' ? 'cancelado' : 
          'estornado ou em processo de estorno'
        }. Por favor, tente novamente.`);
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      
      if (force) {
        setPixLoading(false);
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
  
  // Lidar com mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Limpar erro ao modificar o campo
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
    
    if (name === 'cpf') {
      setFormData(prev => ({ ...prev, [name]: formatCPF(value) }));
    } else if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Validar formulário
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    const cpfClean = formData.cpf.replace(/\D/g, '');
    if (!cpfClean) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (cpfClean.length !== 11) {
      newErrors.cpf = 'CPF deve ter 11 dígitos';
    }
    
    // Telefone é opcional, mas se preenchido deve ser válido
    if (formData.phone) {
      const phoneClean = formData.phone.replace(/\D/g, '');
      if (phoneClean.length < 10 || phoneClean.length > 11) {
        newErrors.phone = 'Telefone inválido';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Enviar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (!user) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você precisa estar logado para assinar um plano.",
      });
      return;
    }
    
    if (!selectedPlan) {
      toast({
        variant: "destructive",
        title: "Plano não selecionado",
        description: "Por favor, selecione um plano para continuar.",
      });
      return;
    }
    
    if (!user.asaasCustomerId) {
      toast({
        variant: "destructive",
        title: "Erro de configuração",
        description: "Não foi possível identificar seu cadastro de cliente. Por favor, tente novamente ou entre em contato com o suporte.",
      });
      return;
    }
    
    setCheckoutState('PROCESSING');
    setIsLoading(true);
    
    try {
      // Extrair CPF sem formatação
      const cpfClean = formData.cpf.replace(/\D/g, '');
      
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
      
      // Se for plano gratuito, concluir diretamente
      if (selectedPlan.id === 'free') {
        setCheckoutState('PAYMENT_SUCCESS');
        toast({
          title: "Plano ativado com sucesso!",
          description: "Seu plano foi ativado com sucesso.",
        });
        
        setTimeout(() => {
          navigate('/payment-success');
        }, 1500);
      } else if (subscription.paymentId) {
        // Para qualquer plano pago, sempre redirecionar para página de pagamento PIX
        window.location.href = `/pagamento?planId=${selectedPlan.id}&customerId=${user.asaasCustomerId}&paymentId=${subscription.paymentId}`;
      } else {
        throw new Error("Não foi possível obter as informações de pagamento");
      }
    } catch (error: any) {
      console.error('Erro no processo de assinatura:', error);
      
      setCheckoutState('ERROR');
      
      let errorMessage = "Ocorreu um erro inesperado ao processar sua assinatura. Por favor, tente novamente.";
      
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          errorMessage = "Serviço de pagamento indisponível no momento. Por favor, tente novamente mais tarde.";
        } else if (error.message.includes('Network Error')) {
          errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
        } else {
          errorMessage = `Erro ao processar assinatura: ${error.message}`;
        }
      }
      
      toast({
        variant: "destructive",
        title: "Erro na assinatura",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Selecionar um plano
  const handlePlanSelect = (plan: any) => {
    setSelectedPlan(plan);
    setCheckoutState('FORM_INPUT');
  };
  
  // Voltar para a seleção de planos
  const handleBackToPlans = () => {
    setCheckoutState('PLAN_SELECTION');
    setSelectedPlan(null);
  };
  
  // Voltar para o formulário
  const handleBackToForm = () => {
    setCheckoutState('FORM_INPUT');
  };
  
  // Tentar novamente (após erro)
  const handleRetry = () => {
    if (selectedPlan) {
      setCheckoutState('FORM_INPUT');
    } else {
      setCheckoutState('PLAN_SELECTION');
    }
    setPixError(null);
  };
  
  // Renderizar seleção de planos
  const renderPlanSelection = () => {
    if (plansLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Escolha seu plano</h1>
          <p className="text-muted-foreground">Selecione o plano que melhor atende às suas necessidades</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          {availablePlans?.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlan?.id === plan.id}
              onSelect={handlePlanSelect}
            />
          ))}
        </div>
      </div>
    );
  };
  
  // Renderizar formulário de pagamento
  const renderPaymentForm = () => {
    if (!selectedPlan) return null;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={handleBackToPlans} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Complete seus dados</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <PersonalInfoForm
            formData={formData}
            errors={errors}
            isLoading={isLoading}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
          
          <SubscriptionSummary plan={selectedPlan} />
        </div>
      </div>
    );
  };
  
  // Renderizar tela de pagamento PIX
  const renderPixPayment = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={handleBackToForm} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Pagamento via PIX</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <PixPaymentCard
            qrCodeImage={qrCodeImage}
            qrCodeText={qrCodeText}
            timeRemaining={timeRemaining}
            pixLoading={pixLoading}
            pixError={pixError}
            onVerifyPayment={() => checkPaymentStatus(true)}
            onTryAgain={loadPixQrCode}
          />
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Instruções de pagamento</CardTitle>
                <CardDescription>Como realizar seu pagamento PIX</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4 list-decimal list-inside">
                  <li className="pl-2">
                    <span className="font-medium">Acesse o app do seu banco</span>
                    <p className="text-sm text-muted-foreground">Abra o aplicativo do seu banco ou instituição financeira.</p>
                  </li>
                  <li className="pl-2">
                    <span className="font-medium">Escolha a opção PIX</span>
                    <p className="text-sm text-muted-foreground">No menu do aplicativo, selecione a opção para pagamento via PIX.</p>
                  </li>
                  <li className="pl-2">
                    <span className="font-medium">Escaneie o QR code</span>
                    <p className="text-sm text-muted-foreground">Use a câmera do seu celular para escanear o QR code exibido.</p>
                  </li>
                  <li className="pl-2">
                    <span className="font-medium">Ou copie o código PIX</span>
                    <p className="text-sm text-muted-foreground">Alternativamente, copie o código PIX e cole no aplicativo do seu banco.</p>
                  </li>
                  <li className="pl-2">
                    <span className="font-medium">Confirme o pagamento</span>
                    <p className="text-sm text-muted-foreground">Verifique os dados e confirme o pagamento no aplicativo do seu banco.</p>
                  </li>
                </ol>
                
                <hr className="my-4" />
                
                <div className="text-sm text-muted-foreground">
                  <p><strong>Status atual:</strong> {paymentStatus ? getPaymentStatusDescription(paymentStatus) : 'Aguardando pagamento'}</p>
                </div>
                
                {selectedPlan && (
                  <div className="flex items-center justify-between font-medium mt-4">
                    <span>Total:</span>
                    <span className="text-xl">R$ {selectedPlan.price.toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {selectedPlan && <SubscriptionSummary plan={selectedPlan} />}
          </div>
        </div>
      </div>
    );
  };
  
  // Renderizar tela de sucesso
  const renderSuccess = () => {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-green-100 p-3 mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Pagamento confirmado!</h1>
        <p className="text-muted-foreground mb-6">Seu pagamento foi processado com sucesso.</p>
        <p className="text-muted-foreground mb-6">Você será redirecionado em instantes...</p>
        <div className="animate-pulse">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  };
  
  // Renderizar tela de erro
  const renderError = () => {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Alert variant="destructive" className="mb-4 max-w-md">
          <AlertTitle>Erro no processamento</AlertTitle>
          <AlertDescription>
            {pixError || "Ocorreu um erro ao processar seu pagamento."}
          </AlertDescription>
        </Alert>
        <Button onClick={handleRetry} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  };
  
  // Renderizar componente de processamento
  const renderProcessing = () => {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h1 className="text-xl font-bold mb-2">Processando seu pedido</h1>
        <p className="text-muted-foreground">Aguarde enquanto preparamos seu pagamento...</p>
      </div>
    );
  };
  
  // Renderizar conteúdo com base no estado atual
  const renderContent = () => {
    if (plansLoading && checkoutState === 'PLAN_SELECTION') {
      return (
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    
    switch (checkoutState) {
      case 'PLAN_SELECTION':
        return renderPlanSelection();
      case 'FORM_INPUT':
        return renderPaymentForm();
      case 'PROCESSING':
        return renderProcessing();
      case 'PAYMENT_PENDING':
        return renderPixPayment();
      case 'PAYMENT_SUCCESS':
        return renderSuccess();
      case 'ERROR':
        return renderError();
      default:
        return null;
    }
  };
  
  return (
    <div className="container py-8 mx-auto">
      {renderContent()}
    </div>
  );
};

export default CheckoutPage; 