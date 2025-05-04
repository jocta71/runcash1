import { Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface PixPaymentCardProps {
  qrCodeImage: string | null;
  qrCodeText: string | null;
  timeRemaining: number;
  pixLoading: boolean;
  pixError: string | null;
  onVerifyPayment: () => void;
  onTryAgain: () => void;
}

export const PixPaymentCard = ({
  qrCodeImage,
  qrCodeText,
  timeRemaining,
  pixLoading,
  pixError,
  onVerifyPayment,
  onTryAgain
}: PixPaymentCardProps) => {
  const { toast } = useToast();

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>QR Code PIX</CardTitle>
        <CardDescription>Escaneie o QR code ou copie o código PIX</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {pixLoading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p>Carregando QR Code...</p>
          </div>
        ) : pixError ? (
          <Alert variant="destructive" className="mb-4 w-full">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{pixError}</AlertDescription>
          </Alert>
        ) : qrCodeImage ? (
          <>
            <div className="p-4 bg-white rounded-lg">
              <img src={qrCodeImage} alt="QR Code PIX" className="w-48 h-48" />
            </div>
            
            <div className="w-full">
              <p className="text-sm text-center mb-2">Tempo restante para pagamento:</p>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <Progress value={timeRemaining} className="h-full" />
              </div>
            </div>
            
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Código PIX:</span>
                <Button variant="outline" size="sm" onClick={copyPIXCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
              <div className="p-3 bg-gray-100 rounded text-xs break-all">
                {qrCodeText}
              </div>
            </div>
            
            <Button
              onClick={onVerifyPayment}
              className="w-full"
              disabled={pixLoading}
            >
              {pixLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Verificar pagamento
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8">
            <p>Não foi possível carregar o QR Code</p>
            <Button onClick={onTryAgain} className="mt-4">
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 