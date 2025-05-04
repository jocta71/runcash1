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
    <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-lg shadow-sm">
      <div className="p-4 flex justify-end">
        <button className="text-gray-500 hover:bg-gray-100 rounded-md p-1 dark:hover:bg-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
      
      <div className="px-6 pb-8 pt-2">
        <h2 className="text-2xl font-bold text-center mb-1">Scan QR code</h2>
        <p className="text-gray-500 text-center text-sm mb-6">
          Escaneie este QR code no app do seu banco para realizar o pagamento.
        </p>
        
        {/* QR Code */}
        <div className="bg-white p-4 rounded-lg border mb-6 flex justify-center">
          {qrCodeImage && qrCodeImage.length > 100 ? (
            <img 
              src={qrCodeImage.startsWith('data:') ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`} 
              alt="QR Code PIX" 
              className="w-48 h-48 mx-auto"
              onError={(e) => {
                console.error('Erro ao carregar imagem QR code:', e);
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
            </div>
          )}
        </div>
        
        <div className="text-center text-sm text-gray-500 mb-4">ou entre o código manualmente</div>
        
        {/* Código PIX Manual */}
        <div className="flex mb-6">
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={qrCodeText} 
              readOnly 
              className="w-full border p-2 rounded-l-md text-sm focus:outline-none"
            />
          </div>
          <button 
            onClick={copyToClipboard}
            className="bg-gray-100 border border-l-0 rounded-r-md px-3 hover:bg-gray-200"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        
        {/* Temporizador */}
        {expirationTime && (
          <div className="text-center text-sm text-gray-500 mb-4">
            Tempo restante: <span className="font-semibold">{expirationTime}</span>
          </div>
        )}
        
        {/* Status do pagamento escondido porém mantendo a funcionalidade */}
        <div className="hidden">
          <PaymentStatus status={paymentStatus} />
        </div>
        
        {/* Botões de ação */}
        <Button
          onClick={onRefreshStatus}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium rounded-md"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Verificando...
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </div>
    </div>
  );
} 