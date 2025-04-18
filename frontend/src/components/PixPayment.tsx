import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { Spinner } from './ui/spinner';
import API_ROUTES from '@/config/api';
import { useToast } from '@/hooks/use-toast';

interface PixPaymentProps {
  paymentId?: string;
  subscriptionId?: string;
  qrCode?: {
    encodedImage: string;
    payload: string;
    expirationDate?: string;
  };
  onPaymentSuccess?: () => void;
}

const PixPayment: React.FC<PixPaymentProps> = ({ 
  paymentId, 
  subscriptionId, 
  qrCode: initialQrCode,
  onPaymentSuccess 
}) => {
  const [qrCode, setQrCode] = useState(initialQrCode);
  const [loading, setLoading] = useState(!initialQrCode);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [autoRegenerated, setAutoRegenerated] = useState(false);
  const { toast } = useToast();
  
  // Tempo limite para expiração do QR Code em milissegundos (1 hora)
  const QR_CODE_EXPIRATION = 60 * 60 * 1000; 
  
  // Intervalo de verificação de status em milissegundos (20 segundos)
  const STATUS_CHECK_INTERVAL = 20 * 1000;
  
  // Estado para controlar o temporizador de verificação
  const [statusCheckTimer, setStatusCheckTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Função para copiar o código PIX
  const copyPixCode = () => {
    if (qrCode?.payload) {
      navigator.clipboard.writeText(qrCode.payload);
      setCopied(true);
      toast({
        title: "Código PIX copiado!",
        description: "Cole o código no aplicativo do seu banco.",
        duration: 3000
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };
  
  // Função para gerar/regenerar QR Code PIX
  const generateQrCode = async () => {
    if (!paymentId && !subscriptionId) {
      console.error("Tentativa de gerar QR Code sem IDs necessários");
      setError('Não foi possível gerar o QR Code: ID de pagamento ou assinatura não fornecido');
      return;
    }
    
    setLoading(true);
    setError(null);
    setRegenerating(true);
    
    console.log(`Gerando QR Code para ${paymentId ? `pagamento ${paymentId}` : `assinatura ${subscriptionId}`}`);
    
    try {
      // Tentar regenerar o QR Code usando a API
      const response = await axios.get(API_ROUTES.payment.regeneratePixCode, {
        params: { 
          paymentId, 
          subscriptionId 
        }
      });
      
      if (response.data.success) {
        console.log("QR Code gerado com sucesso:", {
          hasImage: !!response.data.qrCode.encodedImage,
          hasPayload: !!response.data.qrCode.payload,
          status: response.data.payment.status
        });
        
        setQrCode(response.data.qrCode);
        setPaymentInfo(response.data.payment);
        setError(null);
        
        // Se o pagamento já estiver confirmado, executar callback de sucesso
        if (response.data.payment.status === 'CONFIRMED' || 
            response.data.payment.status === 'RECEIVED') {
          console.log("Pagamento já confirmado");
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }
        }
      } else {
        console.error("Erro retornado pela API:", response.data.error);
        setError(response.data.error || 'Erro ao gerar QR Code');
      }
    } catch (err: any) {
      console.error('Erro ao gerar QR Code:', err);
      setError(err.response?.data?.error || 'Erro ao comunicar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };
  
  // Função para verificar o status do pagamento
  const checkPaymentStatus = async () => {
    if (!paymentId && !(paymentInfo?.id)) {
      return;
    }
    
    setCheckingStatus(true);
    
    try {
      console.log(`Verificando status do pagamento ${paymentId || paymentInfo?.id}...`);
      const response = await axios.get(API_ROUTES.payment.checkStatus, {
        params: { 
          paymentId: paymentId || paymentInfo?.id
        }
      });
      
      console.log(`Status atual: ${response.data.status}`);
      
      if (response.data.status === 'CONFIRMED' || response.data.status === 'RECEIVED') {
        // Pagamento confirmado
        console.log("Pagamento confirmado!");
        toast({
          title: "Pagamento confirmado!",
          description: "Obrigado, seu pagamento foi processado com sucesso.",
          variant: "default",
          duration: 5000
        });
        
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
        
        // Parar a verificação periódica
        if (statusCheckTimer) {
          clearInterval(statusCheckTimer);
          setStatusCheckTimer(null);
        }
      }
      
      // Atualizar as informações do pagamento
      setPaymentInfo({
        ...paymentInfo,
        status: response.data.status
      });
      
    } catch (err) {
      console.error('Erro ao verificar status do pagamento:', err);
    } finally {
      setCheckingStatus(false);
    }
  };
  
  // Efeito para carregar o QR Code inicial se necessário
  useEffect(() => {
    if (!initialQrCode && (paymentId || subscriptionId)) {
      console.log("QR Code não fornecido inicialmente, gerando...");
      generateQrCode();
    }
  }, []);
  
  // Efeito para verificar se é necessário auto-regenerar o QR Code
  useEffect(() => {
    // Se temos IDs mas não temos QR Code ou está sem a imagem, tentar regenerar uma vez automaticamente
    if ((paymentId || subscriptionId) && 
        (!qrCode || !qrCode.encodedImage || !qrCode.payload) && 
        !autoRegenerated && 
        !regenerating) {
      console.log("QR Code ausente ou incompleto, tentando regeneração automática...");
      setAutoRegenerated(true);
      setTimeout(() => {
        generateQrCode();
      }, 2000); // Esperar 2 segundos antes de tentar regenerar
    }
  }, [qrCode, paymentId, subscriptionId, autoRegenerated, regenerating]);
  
  // Efeito para iniciar a verificação periódica de status
  useEffect(() => {
    // Iniciar verificação periódica apenas se temos um QR Code válido
    if (qrCode && (paymentId || paymentInfo?.id)) {
      console.log("Iniciando verificação periódica de status");
      const timer = setInterval(checkPaymentStatus, STATUS_CHECK_INTERVAL);
      setStatusCheckTimer(timer);
      
      return () => {
        clearInterval(timer);
      };
    }
  }, [qrCode, paymentId, paymentInfo?.id]);
  
  // Formatar valor para exibição
  const formatValue = (value?: number) => {
    if (value === undefined) return 'Carregando...';
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };
  
  // Verificar se o QR Code expirou
  const isQrCodeExpired = () => {
    if (!qrCode?.expirationDate) return false;
    
    const expirationDate = new Date(qrCode.expirationDate);
    return expirationDate < new Date();
  };
  
  // Renderizar mensagem baseada no status do pagamento
  const renderStatusMessage = () => {
    if (!paymentInfo) return null;
    
    switch (paymentInfo.status) {
      case 'CONFIRMED':
      case 'RECEIVED':
        return (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
            <p className="font-medium">Pagamento confirmado!</p>
            <p>Seu pagamento foi processado com sucesso.</p>
          </div>
        );
      
      case 'PENDING':
        return isQrCodeExpired() ? (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
            <p className="font-medium">QR Code expirado!</p>
            <p>Gere um novo QR Code para continuar.</p>
          </div>
        ) : null;
      
      case 'OVERDUE':
        return (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p className="font-medium">Pagamento vencido!</p>
            <p>Por favor, gere um novo QR Code.</p>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  if (loading && !regenerating) {
    return (
      <div className="flex flex-col items-center p-6 max-w-md mx-auto">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600">Carregando QR Code PIX...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-center mb-4">Pagamento via PIX</h2>
      
      {/* Mensagem de status */}
      {renderStatusMessage()}
      
      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Erro ao gerar QR Code</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      
      {/* Informações do pagamento */}
      {paymentInfo && (
        <div className="mb-4 p-4 bg-gray-50 rounded-md">
          <p className="text-gray-700"><span className="font-semibold">Valor:</span> {formatValue(paymentInfo.value)}</p>
          {paymentInfo.description && (
            <p className="text-gray-700"><span className="font-semibold">Descrição:</span> {paymentInfo.description}</p>
          )}
          <p className="text-gray-700"><span className="font-semibold">Vencimento:</span> {new Date(paymentInfo.dueDate).toLocaleDateString('pt-BR')}</p>
        </div>
      )}
      
      {/* QR Code */}
      {qrCode && qrCode.encodedImage && qrCode.payload && !isQrCodeExpired() ? (
        <div className="flex flex-col items-center">
          <div className="bg-white p-2 border rounded-md mb-4">
            <img 
              src={`data:image/png;base64,${qrCode.encodedImage}`} 
              alt="QR Code PIX" 
              className="w-64 h-64"
            />
          </div>
          
          <div className="w-full mb-6">
            <p className="text-sm text-gray-500 mb-2 text-center">Código para copiar e colar:</p>
            <div className="flex items-center">
              <div className="bg-gray-100 p-2 rounded-l-md text-xs overflow-hidden text-ellipsis flex-grow">
                <span className="text-gray-700">{qrCode.payload}</span>
              </div>
              <button 
                onClick={copyPixCode}
                className="bg-blue-600 text-white p-2 rounded-r-md hover:bg-blue-700 transition-colors"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-6 border rounded-md mb-4">
          <AlertCircle className="w-10 h-10 text-yellow-500 mb-2" />
          <p className="text-center text-gray-600">QR Code não disponível ou expirado.</p>
          <p className="text-center text-sm text-gray-500 mb-4">Por favor, clique no botão abaixo para gerar o QR Code.</p>
        </div>
      )}
      
      {/* Botão para regenerar */}
      <div className="flex justify-center mt-4">
        <button
          onClick={generateQrCode}
          disabled={regenerating}
          className={`flex items-center justify-center py-2 px-4 rounded-md transition-colors ${
            regenerating || checkingStatus
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {regenerating ? (
            <>
              <Spinner size="sm" className="mr-2" />
              <span>Gerando QR Code...</span>
            </>
          ) : checkingStatus ? (
            <>
              <Spinner size="sm" className="mr-2" />
              <span>Verificando pagamento...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5 mr-2" />
              <span>{qrCode ? 'Atualizar QR Code' : 'Gerar QR Code'}</span>
            </>
          )}
        </button>
      </div>
      
      {/* Instruções */}
      <div className="mt-6 border-t pt-4">
        <h3 className="font-medium text-gray-700 mb-2">Como pagar com PIX:</h3>
        <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
          <li>Abra o aplicativo do seu banco</li>
          <li>Escolha a opção "Pagar com PIX" ou "Ler QR Code"</li>
          <li>Escaneie o QR Code acima ou cole o código copiado</li>
          <li>Confirme os dados do pagamento</li>
          <li>Pronto! Assim que recebermos a confirmação, você será notificado</li>
        </ol>
      </div>
    </div>
  );
};

export default PixPayment; 