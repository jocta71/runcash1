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
          <div className="bg-white p-6 rounded-lg shadow-inner">
            {qrCodeImage && qrCodeImage.length > 100 ? (
              <div className="flex flex-col items-center">
                <img 
                  src={qrCodeImage.startsWith('data:') ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`} 
                  alt="QR Code PIX" 
                  className="w-52 h-52 mx-auto border-2 border-gray-100 rounded-lg p-2"
                  onError={(e) => {
                    console.error('Erro ao carregar imagem QR code:', e);
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('error-loading-qr');
                  }}
                />
                <p className="text-sm font-medium text-gray-700 mt-3">
                  Escaneie o QR code com o aplicativo do seu banco
                </p>
              </div>
            ) : (
              <div className="w-52 h-52 flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-gray-200 mx-auto">
                {remoteLoadingAnimation ? (
                  <div className="w-20 h-20 mb-2">
                    <Lottie animationData={remoteLoadingAnimation} loop={true} />
                  </div>
                ) : (
                  <Loader2 className="h-10 w-10 animate-spin text-gray-400 mb-2" />
                )}
                <p className="text-sm text-gray-600 font-medium">
                  Preparando QR Code...
                </p>
              </div>
            )}
          </div>
          
          {/* Temporizador */}
          {expirationTime && (
            <div className="text-center py-2 px-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg max-w-md">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                Tempo restante: <span className="font-bold">{expirationTime}</span>
              </p>
            </div>
          )}
          
          {/* Instruções */}
          <div className="w-full max-w-md bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
            <h4 className="font-medium text-center mb-3 text-gray-700 dark:text-gray-300">Como pagar com PIX</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="bg-vegas-gold text-black rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mr-2">
                  <span className="text-sm font-bold">1</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Abra o aplicativo do seu banco</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-vegas-gold text-black rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mr-2">
                  <span className="text-sm font-bold">2</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Escolha a opção de pagar com QR Code PIX</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-vegas-gold text-black rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mr-2">
                  <span className="text-sm font-bold">3</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Escaneie o código acima ou use o código PIX copiado</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-vegas-gold text-black rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mr-2">
                  <span className="text-sm font-bold">4</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">Confirme o pagamento e aguarde a confirmação automática</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        <Button
          onClick={copyToClipboard}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 border-vegas-gold/60 hover:bg-vegas-gold/10 hover:border-vegas-gold"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-vegas-gold" />}
          {copied ? "Código PIX copiado!" : "Copiar código PIX"}
        </Button>
        
        <Button
          onClick={onRefreshStatus}
          variant="secondary"
          disabled={isRefreshing}
          className="w-full flex items-center justify-center gap-2 bg-vegas-gold/10 hover:bg-vegas-gold/20 text-vegas-gold border border-vegas-gold/30"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isRefreshing ? "Verificando pagamento..." : "Verificar status do pagamento"}
        </Button>
      </CardFooter>
    </Card>
  );
} 