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
    <Card className="w-full bg-gradient-to-br from-[#0d2330] to-[#102b36] rounded-2xl shadow-[8px_8px_16px_rgba(0,0,0,0.4),-8px_-8px_16px_rgba(25,43,51,0.4)] border-t border-l border-[rgba(255,255,255,0.08)] backdrop-blur-sm overflow-hidden">
      <CardContent className="pt-8 px-8">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative z-10">
            <h3 className="text-2xl font-semibold text-center text-white">
              Pagamento via <span className="text-green-400">PIX</span>
            </h3>
            <div className="absolute -top-4 -right-4 w-10 h-10 bg-green-500/20 rounded-full blur-xl"></div>
            <div className="absolute -bottom-2 -left-4 w-8 h-8 bg-blue-500/20 rounded-full blur-lg"></div>
          </div>
          
          {/* Status do pagamento */}
          <div className="w-full mb-2">
            <div className="flex flex-col items-center">
              <PaymentStatus status={paymentStatus} />
            </div>
          </div>
          
          {/* QR Code */}
          <div className="bg-gradient-to-br from-[#111c26] to-[#152635] p-8 rounded-2xl shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.05)] backdrop-blur-sm relative">
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-green-500/10 rounded-full blur-xl"></div>
            {qrCodeImage && qrCodeImage.length > 100 ? (
              <div className="flex flex-col items-center relative z-10">
                <div className="bg-white p-4 rounded-xl shadow-[0_10px_20px_rgba(0,0,0,0.25)] relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-green-500/10 rounded-full blur-xl"></div>
                  <img 
                    src={qrCodeImage.startsWith('data:') ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`} 
                    alt="QR Code PIX" 
                    className="w-52 h-52 mx-auto relative z-10"
                    onError={(e) => {
                      console.error('Erro ao carregar imagem QR code:', e);
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.classList.add('error-loading-qr');
                    }}
                  />
                </div>
                <div className="mt-4 text-center relative z-10">
                  <p className="text-sm font-medium text-gray-300">
                    Escaneie o QR code com o aplicativo do seu banco
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-52 h-52 flex flex-col items-center justify-center bg-gradient-to-br from-[#131e28] to-[#162837] rounded-xl mx-auto shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.05)] relative">
                <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-blue-500/20 rounded-full blur-lg"></div>
                {remoteLoadingAnimation ? (
                  <div className="w-24 h-24 mb-2 relative z-10">
                    <Lottie animationData={remoteLoadingAnimation} loop={true} />
                  </div>
                ) : (
                  <Loader2 className="h-12 w-12 animate-spin text-blue-400 mb-2 relative z-10" />
                )}
                <p className="text-sm text-gray-300 font-medium relative z-10">
                  Preparando QR Code...
                </p>
              </div>
            )}
          </div>
          
          {/* Temporizador */}
          {expirationTime && (
            <div className="relative">
              <div className="text-center py-2 px-8 bg-gradient-to-r from-[#152635] to-[#1a2e3e] border border-[rgba(255,255,255,0.08)] rounded-full shadow-[2px_2px_4px_rgba(0,0,0,0.2),-2px_-2px_4px_rgba(255,255,255,0.05),inset_1px_1px_1px_rgba(255,255,255,0.05)]">
                <p className="text-yellow-300 text-sm font-medium">
                  Tempo restante: <span className="font-bold">{expirationTime}</span>
                </p>
              </div>
              <div className="absolute -top-2 -left-2 w-8 h-8 bg-yellow-500/20 rounded-full blur-lg"></div>
            </div>
          )}
          
          {/* Instruções */}
          <div className="w-full max-w-md bg-gradient-to-br from-[#101b25] to-[#142432] rounded-xl p-6 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.05)] relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-16 h-16 bg-blue-500/10 rounded-full blur-xl"></div>
            <div className="absolute -bottom-8 -left-8 w-16 h-16 bg-green-500/10 rounded-full blur-xl"></div>
            
            <h4 className="font-medium text-center mb-5 text-blue-300 relative z-10">Como pagar com PIX</h4>
            <div className="space-y-4 relative z-10">
              <div className="flex items-start">
                <div className="bg-gradient-to-br from-[#152334] to-[#1c2e41] text-green-400 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(255,255,255,0.05)]">
                  <span className="text-sm font-bold">1</span>
                </div>
                <p className="text-sm text-gray-300 pt-1.5">Abra o aplicativo do seu banco</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-gradient-to-br from-[#152334] to-[#1c2e41] text-green-400 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(255,255,255,0.05)]">
                  <span className="text-sm font-bold">2</span>
                </div>
                <p className="text-sm text-gray-300 pt-1.5">Escolha a opção de pagar com QR Code PIX</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-gradient-to-br from-[#152334] to-[#1c2e41] text-green-400 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(255,255,255,0.05)]">
                  <span className="text-sm font-bold">3</span>
                </div>
                <p className="text-sm text-gray-300 pt-1.5">Escaneie o código acima ou use o código PIX copiado</p>
              </div>
              
              <div className="flex items-start">
                <div className="bg-gradient-to-br from-[#152334] to-[#1c2e41] text-green-400 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mr-3 shadow-[2px_2px_3px_rgba(0,0,0,0.2),inset_1px_1px_1px_rgba(255,255,255,0.05)]">
                  <span className="text-sm font-bold">4</span>
                </div>
                <p className="text-sm text-gray-300 pt-1.5">Confirme o pagamento e aguarde a confirmação automática</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-4 p-8 relative">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-[rgba(10,20,30,0.5)] to-transparent"></div>
        
        <Button
          onClick={copyToClipboard}
          variant="outline"
          className="w-full py-3 rounded-xl bg-gradient-to-br from-[#152334] to-[#1c2e41] text-green-400 font-medium shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.05),inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:translate-y-0.5 transition-all duration-200 border-none relative z-10"
        >
          {copied ? <Check className="h-4 w-4 text-green-500 mr-2" /> : <Copy className="h-4 w-4 text-green-400 mr-2" />}
          {copied ? "Código PIX copiado!" : "Copiar código PIX"}
        </Button>
        
        <Button
          onClick={onRefreshStatus}
          variant="secondary"
          disabled={isRefreshing}
          className="w-full py-3 rounded-xl bg-gradient-to-br from-[#152334] to-[#1c2e41] text-blue-400 font-medium shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[2px_2px_4px_rgba(0,0,0,0.3),-2px_-2px_4px_rgba(255,255,255,0.05),inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] hover:translate-y-0.5 transition-all duration-200 border-none relative z-10"
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