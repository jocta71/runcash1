import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { PaymentForm } from '@/components/PaymentForm';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { findAsaasPayment, getAsaasPixQrCode } from '@/integrations/asaas/client';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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
      const interval = setInterval(() => {
        checkPaymentStatus();
      }, 10000); // Verificar a cada 10 segundos
      
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
      const pixData = await getAsaasPixQrCode(paymentId);
      
      setQrCodeImage(pixData.qrCodeImage);
      setQrCodeText(pixData.qrCodeText);
      setExpirationDate(pixData.expirationDate || null);
      
      setPixLoading(false);
    } catch (error) {
      setPixLoading(false);
      setPixError('Não foi possível carregar o QR Code PIX. Tente novamente.');
      console.error('Erro ao carregar QR Code PIX:', error);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentId) return;
    
    try {
      const payment = await findAsaasPayment(paymentId);
      
      setPaymentStatus(payment.status);
      
      // Se o pagamento foi confirmado
      if (payment && (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED')) {
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
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
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
      <div className="container mx-auto py-12 px-4 max-w-4xl">
        <Button 
          variant="ghost" 
          className="mb-6" 
          onClick={() => navigate('/planos')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para planos
        </Button>

        <div className="bg-vegas-black/40 border border-gray-700 rounded-lg p-6 mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Pagamento via PIX</h1>
          <p className="text-gray-400 mb-6">
            Escaneie o QR Code abaixo com o aplicativo do seu banco para finalizar o pagamento
          </p>
          
          {pixError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{pixError}</AlertDescription>
            </Alert>
          )}
          
          {pixLoading ? (
            <div className="flex justify-center my-12">
              <Loader2 className="h-12 w-12 animate-spin text-vegas-gold" />
            </div>
          ) : (
            <>
              {qrCodeImage && (
                <div className="flex flex-col items-center space-y-6">
                  <div className="bg-white p-4 rounded-lg">
                    <img 
                      src={`data:image/png;base64,${qrCodeImage}`} 
                      alt="QR Code PIX" 
                      className="w-48 h-48"
                    />
                  </div>
                  
                  <div className="w-full max-w-lg mx-auto">
                    <p className="font-semibold mb-2">Ou copie o código PIX:</p>
                    <div className="flex">
                      <input
                        type="text"
                        value={qrCodeText || ''}
                        readOnly
                        className="w-full bg-gray-800 border border-gray-700 rounded-l-md p-2 text-sm"
                      />
                      <Button 
                        variant="secondary"
                        className="rounded-l-none"
                        onClick={copyPIXCode}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                  
                  {expirationDate && (
                    <Alert className="max-w-lg">
                      <AlertTitle>Atenção</AlertTitle>
                      <AlertDescription>
                        Este QR Code expira em: {new Date(expirationDate).toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Alert className="max-w-lg bg-vegas-gold/20 border-vegas-gold text-vegas-gold">
                    <AlertTitle>Importante</AlertTitle>
                    <AlertDescription>
                      Após o pagamento, esta página será atualizada automaticamente.
                      Não feche esta página até a confirmação do pagamento.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Renderizar o formulário normal de pagamento
  return (
    <div className="container mx-auto py-12 px-4 max-w-4xl">
      <Button 
        variant="ghost" 
        className="mb-6" 
        onClick={() => navigate('/planos')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para planos
      </Button>

      <div className="bg-vegas-black/40 border border-gray-700 rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold mb-2">Finalizar assinatura</h1>
        <p className="text-gray-400 mb-4">
          Você selecionou o plano <span className="font-semibold text-vegas-gold">{selectedPlan.name}</span>
        </p>
        
        <div className="flex items-center justify-between border-t border-gray-700 pt-4 mt-4">
          <div>
            <p className="text-sm text-gray-400">Valor</p>
            <p className="text-xl font-bold">
              {selectedPlan.price === 0 
                ? 'Grátis' 
                : `R$ ${selectedPlan.price.toFixed(2)}/${selectedPlan.interval === 'monthly' ? 'mês' : 'ano'}`}
            </p>
          </div>
          
          {selectedPlan.interval === 'annual' && (
            <div className="bg-vegas-gold/20 text-vegas-gold text-sm px-3 py-1 rounded-full">
              2 meses grátis
            </div>
          )}
        </div>
      </div>

      <PaymentForm 
        planId={planId || ''} 
        onPaymentSuccess={handlePaymentSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default PaymentPage; 