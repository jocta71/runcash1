import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { PaymentForm } from '@/components/PaymentForm';
import { Loader2, ArrowLeft, CheckCircle, AlertCircle, Copy, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { findAsaasPayment, getAsaasPixQrCode } from '@/integrations/asaas/client';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

const PaymentPage = () => {
  const { planId: routePlanId } = useParams<{ planId: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryPlanId = queryParams.get('planId');
  const customerId = queryParams.get('customerId');
  const paymentId = queryParams.get('paymentId');
  
  // Determinar qual planId usar (da rota ou da query string)
  const planId = routePlanId || queryPlanId;
  
  const { availablePlans, loading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados para o QR code PIX
  const [showingPix, setShowingPix] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCodeText, setQrCodeText] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [checkingInterval, setCheckingInterval] = useState<NodeJS.Timeout | null>(null);

  // Determinar se estamos no modo de formulário ou de pagamento PIX
  const isPixPaymentMode = !!(customerId && paymentId);

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

  // Efeito para carregar o QR code PIX quando estiver no modo de pagamento PIX
  useEffect(() => {
    if (isPixPaymentMode && paymentId) {
      setShowingPix(true);
      loadPixQrCode();
      
      // Configurar verificação periódica do status do pagamento
      // Aumentar intervalo para 5 segundos para reduzir carga no servidor
      const interval = setInterval(() => {
        checkPaymentStatus();
      }, 5000); // Verificar a cada 5 segundos
      
      setCheckingInterval(interval);
      
      // Limpar intervalo quando o componente for desmontado
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [isPixPaymentMode, paymentId]);

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

  const checkPaymentStatus = async (force: boolean = false) => {
    if (!paymentId) return;
    
    try {
      console.log('Verificando status do pagamento:', paymentId, force ? '(verificação forçada)' : '');
      
      // Se for verificação forçada, mostrar indicador de carregamento
      if (force) {
        setPixLoading(true);
      }
      
      // Buscar o status atualizado do pagamento (com parâmetro para forçar atualização)
      const payment = await findAsaasPayment(paymentId, force);
      
      console.log('Status do pagamento:', payment.status, 'Dados completos:', payment);
      setPaymentStatus(payment.status);
      
      // Sempre desativar o indicador de carregamento após verificação forçada
      if (force) {
        setPixLoading(false);
        
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
        
        // Mostrar alerta de problema
        setPixError(`Pagamento ${
          payment.status === 'OVERDUE' ? 'expirado' : 
          payment.status === 'CANCELED' ? 'cancelado' : 
          'estornado ou em processo de estorno'
        }. Por favor, tente novamente.`);
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      
      // Se for verificação forçada, desabilitar carregamento e mostrar erro
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

  // Função helper para obter descrição do status de pagamento
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

  const copyPIXCode = () => {
    if (qrCodeText) {
      navigator.clipboard.writeText(qrCodeText)
        .then(() => {
          toast({
            title: "Código copiado!",
            description: "O código PIX foi copiado para a área de transferência.",
          });
        })
        .catch(err => {
          console.error('Erro ao copiar código:', err);
        });
    }
  };

  const handlePaymentSuccess = () => {
    navigate('/payment-success');
  };

  const handleCancel = () => {
    navigate('/planos');
  };

  // Wrapper para o checkPaymentStatus que pode ser usado como handler de evento de clique
  const handleCheckPaymentStatus = () => {
    checkPaymentStatus(true);
  };

  if (loading || (!selectedPlan && !isPixPaymentMode)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Renderizar a página de QR code PIX
  if (isPixPaymentMode) {
    return (
      <div className="py-4 px-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white">Pagamento</h1>
            <Button 
              onClick={handleCancel} 
              variant="outline" 
              size="sm"
              className="h-8 text-xs"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Voltar
            </Button>
          </div>
          
          {!isPixPaymentMode && selectedPlan && (
            <div className="mb-4">
              <div className="bg-vegas-black/60 border border-vegas-gold rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold">{selectedPlan.name}</h3>
                  <Badge variant="outline" className="bg-vegas-gold text-black font-medium border-none">
                    {selectedPlan.price === 0 
                      ? 'Grátis' 
                      : `R$ ${selectedPlan.price.toFixed(2)}/${selectedPlan.interval === 'monthly' ? 'mês' : 'ano'}`}
                  </Badge>
                </div>
                <p className="text-xs text-gray-300 mb-3">{selectedPlan.description}</p>
                <div className="flex items-center">
                  <Clock className="text-vegas-gold h-3 w-3 mr-1" />
                  <span className="text-xs text-gray-300">
                    {selectedPlan.interval === 'monthly' ? 'Cobrança mensal' : 'Cobrança anual'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {pixLoading ? (
            <div className="flex flex-col items-center justify-center p-8">
              <Spinner size="lg" />
              <p className="mt-4 text-center text-sm text-gray-400">
                {pixError || "Iniciando processamento do pagamento..."}
              </p>
            </div>
          ) : (
            <>
              {paymentStatus === 'RECEIVED' || paymentStatus === 'CONFIRMED' || paymentStatus === 'AVAILABLE' || paymentStatus === 'BILLING_AVAILABLE' ? (
                <div className="p-3 bg-green-900/20 border border-green-500 rounded-lg text-center">
                  <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-2" />
                  <h3 className="text-lg font-bold mb-2 text-green-400">Pagamento Processado</h3>
                  <p className="text-xs text-gray-300 mb-3">
                    Seu pagamento foi processado com sucesso. Aguarde a confirmação do PIX.
                  </p>
                  <Button className="w-full text-xs h-8 mt-2" onClick={handlePaymentSuccess}>
                    Ver Detalhes da Assinatura
                  </Button>
                </div>
              ) : (
                <>
                  {paymentStatus === 'OVERDUE' || paymentStatus === 'CANCELED' || paymentStatus === 'REFUNDED' || paymentStatus === 'REFUND_REQUESTED' ? (
                    <div className="p-3 bg-red-900/20 border border-red-500 rounded-lg text-center">
                      <AlertCircle className="h-10 w-10 mx-auto text-red-500 mb-2" />
                      <h3 className="text-lg font-bold mb-2 text-red-400">Erro no Pagamento</h3>
                      <p className="text-xs text-gray-300 mb-3">{pixError}</p>
                      <Button className="w-full text-xs h-8 mt-2" onClick={loadPixQrCode}>
                        Tentar Novamente
                      </Button>
                    </div>
                  ) : (
                    <>
                      {qrCodeImage && (
                        <div className="border border-gray-700 rounded-lg p-3">
                          <h3 className="text-sm font-bold mb-3">QR Code PIX</h3>
                          <div className="flex justify-center mb-4">
                            <div className="bg-white p-2 rounded-lg inline-block">
                              <img
                                src={`data:image/png;base64,${qrCodeImage}`}
                                alt="QR Code PIX"
                                className="h-32 w-32"
                              />
                            </div>
                          </div>
                          <div className="flex justify-center">
                            <Button 
                              size="sm" 
                              onClick={copyPIXCode}
                              className="text-xs"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copiar Código PIX
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="border border-gray-700 rounded-lg p-3">
                        <h3 className="text-sm font-bold mb-2">Instruções de Pagamento</h3>
                        <ol className="space-y-2 text-xs text-gray-300 list-decimal pl-4">
                          <li>Abra o aplicativo do seu banco</li>
                          <li>Encontre a opção de pagamento via PIX</li>
                          <li>Escaneie o QR code ou cole o código PIX copiado</li>
                          <li>Confira os dados e finalize o pagamento</li>
                          <li>Após o pagamento, sua assinatura será ativada automaticamente</li>
                        </ol>
                      </div>
                      
                      <div className="border border-gray-700 rounded-lg p-3">
                        <h3 className="text-sm font-bold mb-2">Detalhes do Pagamento</h3>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Valor:</span>
                            <span className="font-semibold">{selectedPlan?.price?.toFixed(2) || 'R$ 0.00'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Data:</span>
                            <span>{new Date().toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Método:</span>
                            <span>PIX</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Status:</span>
                            <Badge variant="outline" className="bg-yellow-900/30 text-yellow-400 border-yellow-500 text-xs">
                              Aguardando Pagamento
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        className="w-full text-xs h-8"
                        onClick={handleCheckPaymentStatus}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Verificar Status do Pagamento
                      </Button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Renderizar o formulário normal de pagamento
  return (
    <div className="py-4 px-2">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Finalizar Assinatura</h1>
          <Button 
            onClick={handleCancel} 
            variant="outline" 
            size="sm"
            className="h-8 text-xs"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Voltar
          </Button>
        </div>

        {selectedPlan && (
          <div className="bg-vegas-black/60 border border-vegas-gold rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-bold">{selectedPlan.name}</h3>
              <Badge variant="outline" className="bg-vegas-gold text-black font-medium border-none text-xs">
                {selectedPlan.price === 0 
                  ? 'Grátis' 
                  : `R$ ${selectedPlan.price.toFixed(2)}/${selectedPlan.interval === 'monthly' ? 'mês' : 'ano'}`}
              </Badge>
            </div>
            <p className="text-xs text-gray-300 mb-3">{selectedPlan.description}</p>
            <div className="flex items-center">
              <Clock className="text-vegas-gold h-3 w-3 mr-1" />
              <span className="text-xs text-gray-300">
                {selectedPlan.interval === 'monthly' ? 'Cobrança mensal' : 'Cobrança anual'}
              </span>
            </div>
            
            {selectedPlan.interval === 'annual' && (
              <div className="mt-2 inline-block bg-vegas-gold/20 text-vegas-gold text-xs px-2 py-0.5 rounded-full">
                2 meses grátis
              </div>
            )}
          </div>
        )}

        <PaymentForm 
          planId={planId || ''} 
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
};

export default PaymentPage; 