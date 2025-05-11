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
    <Card className="w-full bg-neutral-900 rounded-2xl shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(30,30,30,0.4)] border-t border-l border-neutral-800/50 overflow-hidden">
      <CardContent className="pt-8 px-8">
        <div className="flex flex-col items-center space-y-6">
          <h3 className="text-2xl font-semibold text-center text-vegas-gold">Pagamento via PIX</h3>
          
          {/* Status do pagamento */}
          <div className="w-full mb-2">
            <div className="flex flex-col items-center">
              <PaymentStatus status={paymentStatus} />
            </div>
          </div>
          
          {/* QR Code */}
          <div className="bg-neutral-800 p-6 rounded-2xl shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2),inset_-2px_-2px_5px_rgba(50,50,50,0.3)]">
            {qrCodeImage && qrCodeImage.length > 100 ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-3 rounded-xl shadow-[4px_4px_8px_rgba(0,0,0,0.2)]">
                  <img 
                    src={qrCodeImage.startsWith('data:') ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`} 
                    alt="QR Code PIX" 
                    className="w-52 h-52 mx-auto"
                    onError={(e) => {
                      console.error('Erro ao carregar imagem QR code:', e);
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('error-loading-qr');
                    }}
                  />
                </div>
                <p className="text-sm font-medium text-neutral-300 mt-4">
                  Escaneie o QR code com o aplicativo do seu banco
                </p>
              </div>
            ) : (
              <div className="w-52 h-52 flex flex-col items-center justify-center bg-neutral-800 rounded-xl mx-auto shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2),inset_-2px_-2px_5px_rgba(50,50,50,0.3)]">
                {remoteLoadingAnimation ? (
                  <div className="w-20 h-20 mb-2">
                    <Lottie animationData={remoteLoadingAnimation} loop={true} />
                  </div>
                ) : (
                  <Loader2 className="h-10 w-10 animate-spin text-vegas-gold mb-2" />
                )}
                <p className="text-sm text-neutral-300 font-medium">
                  Preparando QR Code...
                </p>
              </div>
            )}
          </div>
          
          {/* Temporizador */}
          {expirationTime && (
            <div className="text-center py-2 px-6 bg-neutral-800 border border-neutral-700 rounded-full shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(40,40,40,0.3),inset_1px_1px_1px_rgba(60,60,60,0.3)]">
              <p className="text-vegas-gold text-sm font-medium">
                Tempo restante: <span className="font-bold">{expirationTime}</span>
              </p>
            </div>
          )}
          
          {/* Instruções */}
          <div className="w-full max-w-md bg-neutral-800/50 rounded-xl p-5 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.2),inset_-2px_-2px_5px_rgba(50,50,50,0.3)]">
            <h4 className="font-medium text-center mb-4 text-vegas-gold">Como pagar com PIX</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="bg-neutral-800/50 text-vegas-gold rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(40,40,40,0.5)]">
                  <span className="text-sm font-bold">1</span>
                </div>
                <p className="text-sm text-neutral-300">Abra o aplicativo do seu banco</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-neutral-800/50 text-vegas-gold rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(40,40,40,0.5)]">
                  <span className="text-sm font-bold">2</span>
                </div>
                <p className="text-sm text-neutral-300">Escolha a opção de pagar com QR Code PIX</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-neutral-800/50 text-vegas-gold rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(40,40,40,0.5)]">
                  <span className="text-sm font-bold">3</span>
                </div>
                <p className="text-sm text-neutral-300">Escaneie o código acima ou use o código PIX copiado</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-neutral-800/50 text-vegas-gold rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(40,40,40,0.5)]">
                  <span className="text-sm font-bold">4</span>
                </div>
                <p className="text-sm text-neutral-300">Confirme o pagamento e aguarde a confirmação automática</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3 p-8">
        <Button
          onClick={copyToClipboard}
          variant="outline"
          className="w-full py-2.5 rounded-xl bg-neutral-800 text-vegas-gold font-medium shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(40,40,40,0.3)] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(40,40,40,0.3),inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(40,40,40,0.3)] hover:translate-y-0.5 transition-all duration-200 border-0"
        >
          {copied ? <Check className="h-4 w-4 text-green-500 mr-2" /> : <Copy className="h-4 w-4 text-vegas-gold mr-2" />}
          {copied ? "Código PIX copiado!" : "Copiar código PIX"}
        </Button>
        
        <Button
          onClick={onRefreshStatus}
          variant="secondary"
          disabled={isRefreshing}
          className="w-full py-2.5 rounded-xl bg-vegas-gold/20 text-vegas-gold font-medium shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(40,40,40,0.3)] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(40,40,40,0.3),inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(40,40,40,0.3)] hover:translate-y-0.5 transition-all duration-200 border-0"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {isRefreshing ? "Verificando pagamento..." : "Verificar status do pagamento"}
        </Button>
      </CardFooter>
    </Card>
  );
} 