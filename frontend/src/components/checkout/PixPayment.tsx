import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { PaymentStatus } from './PaymentStatus';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Lottie from 'lottie-react';
import waitingAnimation from '../../assets/animations/waiting-payment.json';

// URL da nova animação de carregamento
const LOADING_ANIMATION_URL = 'https://lottie.host/d56e4d2c-762c-42da-8a8c-34f1fd70c617/TVGDVAZYhW.json';

interface PixPaymentProps {
  qrCodeImage: string;
  qrCodeText: string;
  paymentStatus: string;
  expirationTime?: string;
  onRefreshStatus: () => Promise<void>;
  isRefreshing: boolean;
}

export function PixPayment({
  qrCodeImage,
  qrCodeText,
  paymentStatus,
  expirationTime,
  onRefreshStatus,
  isRefreshing
}: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
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
    
    fetchAnimation();
  }, []);

  // Debug para verificar os valores recebidos
  useEffect(() => {
    console.log("PixPayment recebeu:", { 
      qrCodeImage: qrCodeImage ? `${qrCodeImage.substring(0, 30)}... (${qrCodeImage.length} chars)` : 'VAZIO', 
      qrCodeImageLength: qrCodeImage?.length || 0,
      qrCodeText: qrCodeText ? `${qrCodeText.substring(0, 30)}... (${qrCodeText.length} chars)` : 'VAZIO',
      paymentStatus, 
      expirationTime 
    });
    
    // Tentar mostrar a imagem no console como base64
    if (qrCodeImage && qrCodeImage.length > 0) {
      console.log('QR Code pronto para teste:', qrCodeImage.startsWith('data:') ? 
        'Já começa com data:' : 
        'Precisa adicionar prefixo data:image/png;base64,');
    }
  }, [qrCodeImage, qrCodeText, paymentStatus, expirationTime]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeText);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "O código PIX foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar código PIX:", err);
      toast({
        variant: "destructive",
        title: "Erro ao copiar",
        description: "Não foi possível copiar o código PIX. Tente novamente.",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          <h3 className="text-xl font-semibold text-center">Pagamento via PIX</h3>
          
          {/* Status do pagamento */}
          <div className="w-full mb-4">
            <div className="flex flex-col items-center">
              <PaymentStatus status={paymentStatus} />
            </div>
          </div>
          
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            {qrCodeImage && qrCodeImage.length > 100 ? (
              <img 
                src={qrCodeImage.startsWith('data:') ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`} 
                alt="QR Code PIX" 
                className="w-48 h-48 mx-auto"
                onError={(e) => {
                  console.error('Erro ao carregar imagem QR code:', e);
                  // Mostrar feedback visual em caso de erro na imagem
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('error-loading-qr');
                }}
              />
            ) : (
              <div className="w-48 h-48 flex flex-col items-center justify-center bg-gray-100">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
                <p className="text-xs text-gray-500">
                  {qrCodeImage ? 'QR Code inválido ou incompleto' : 'Carregando QR Code...'}
                </p>
                {qrCodeImage && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tamanho: {qrCodeImage.length} caracteres
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Temporizador */}
          {expirationTime && (
            <div className="text-center text-sm text-gray-500">
              Tempo restante: <span className="font-semibold">{expirationTime}</span>
            </div>
          )}
          
          {/* Instruções */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 space-y-2 w-full">
            <p>1. Abra o aplicativo do seu banco</p>
            <p>2. Escolha pagar via PIX com QR Code</p>
            <p>3. Escaneie o código acima ou copie o código</p>
            <p>4. Confirme o pagamento no app do seu banco</p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={copyToClipboard}
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado!" : "Copiar código PIX"}
        </Button>
        
        <Button
          onClick={onRefreshStatus}
          variant="secondary"
          disabled={isRefreshing}
          className="w-full flex items-center justify-center gap-2"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isRefreshing ? "Verificando..." : "Verificar pagamento"}
        </Button>
      </CardFooter>
    </Card>
  );
} 