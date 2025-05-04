import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { PaymentStatus } from './PaymentStatus';
import { Check, Copy, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [imageError, setImageError] = useState(false);
  const [retries, setRetries] = useState(0);
  const { toast } = useToast();

  // Resetar estado de erro da imagem quando receber novos dados
  useEffect(() => {
    if (qrCodeImage) {
      setImageError(false);
      console.log('Recebidos novos dados de QR code:', { 
        tamanho: qrCodeImage?.length,
        inicio: qrCodeImage?.substring(0, 20) 
      });
    }
  }, [qrCodeImage]);

  // Tentar novamente após erro na imagem
  useEffect(() => {
    if (imageError && retries < 3) {
      const timer = setTimeout(() => {
        console.log(`Tentativa ${retries + 1} de recarregar o QR code...`);
        setImageError(false);
        setRetries(prev => prev + 1);
        onRefreshStatus();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [imageError, retries, onRefreshStatus]);

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

  // Função para formatar corretamente a imagem do QR Code
  const formatQrCodeImage = (imageData: string) => {
    if (!imageData) {
      console.error('Dados de imagem vazios');
      return '';
    }

    console.log('Formatando QR code:', {
      tamanho: imageData.length,
      comecoComData: imageData.startsWith('data:'),
      comecoComBase64: imageData.startsWith('base64,'),
      primeirosCaracteres: imageData.substring(0, 30)
    });

    // Se a string já começa com data:image, usá-la diretamente
    if (imageData.startsWith('data:image')) {
      return imageData;
    }
    
    // Se começa com "base64," adicionar apenas o prefixo data:image/png;
    if (imageData.startsWith('base64,')) {
      return `data:image/png;${imageData}`;
    }
    
    // Caso contrário, adicionar o prefixo completo
    return `data:image/png;base64,${imageData}`;
  };

  // Callback para quando a imagem não carregar
  const handleImageError = () => {
    console.error('Erro ao carregar imagem do QR code');
    setImageError(true);
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-4">
          <h3 className="text-xl font-semibold text-center">Pagamento via PIX</h3>
          
          {/* Status do pagamento */}
          <div className="w-full mb-4">
            <PaymentStatus status={paymentStatus} />
          </div>
          
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            {(!qrCodeImage || imageError) ? (
              isRefreshing ? (
                <div className="w-48 h-48 flex flex-col items-center justify-center bg-gray-100">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
                  <p className="text-xs text-gray-500">Carregando QR Code...</p>
                </div>
              ) : (
                <div className="w-48 h-48 flex flex-col items-center justify-center bg-gray-100">
                  <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
                  <p className="text-xs text-gray-500 text-center px-2">
                    {retries >= 3 
                      ? "Não foi possível carregar o QR Code. Tente copiar o código PIX."
                      : "Tentando recarregar o QR Code..."}
                  </p>
                </div>
              )
            ) : (
              <img 
                src={formatQrCodeImage(qrCodeImage)} 
                alt="QR Code PIX" 
                className="w-48 h-48 mx-auto"
                onError={handleImageError}
              />
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
          disabled={!qrCodeText}
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