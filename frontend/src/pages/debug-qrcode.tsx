import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAsaasPixQrCode } from '@/integrations/asaas/client';
import { Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';

const DebugQrCodePage = () => {
  const [paymentId, setPaymentId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);

  const handleFetchQrCode = async () => {
    if (!paymentId) {
      setError('Por favor, insira um ID de pagamento');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setQrCodeImage(null);

    try {
      const pixData = await getAsaasPixQrCode(paymentId);
      setResult(pixData);
      
      // Processar a imagem do QR code
      if (pixData.qrCodeImage) {
        const finalImage = pixData.qrCodeImage.startsWith('data:image') 
          ? pixData.qrCodeImage 
          : `data:image/png;base64,${pixData.qrCodeImage}`;
        setQrCodeImage(finalImage);
      }
    } catch (err) {
      console.error('Erro ao buscar QR code:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Diagnóstico de QR Code PIX</h1>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Teste de QR Code PIX</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Input
                placeholder="ID do pagamento"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="flex-grow"
              />
              <Button 
                onClick={handleFetchQrCode} 
                disabled={loading || !paymentId}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Buscar QR Code
              </Button>
            </div>
            
            {error && (
              <div className="bg-red-500/20 p-3 rounded-md text-red-600 mb-4">
                {error}
              </div>
            )}
            
            {loading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            
            {result && (
              <div className="mt-4">
                <h3 className="font-bold mb-2">Resultado da API:</h3>
                <pre className="bg-gray-900 p-4 rounded-md text-xs overflow-auto max-h-60">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
            
            {qrCodeImage && (
              <div className="mt-6">
                <h3 className="font-bold mb-2">QR Code (Visualização):</h3>
                <div className="bg-white p-4 rounded-md inline-block">
                  <img 
                    src={qrCodeImage} 
                    alt="QR Code PIX" 
                    className="w-48 h-48"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Instruções de Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p>
                1. Insira um ID de pagamento válido do Asaas
              </p>
              <p>
                2. Clique em "Buscar QR Code" para testar a API
              </p>
              <p>
                3. Verifique se a resposta contém as propriedades <code>qrCodeImage</code> e <code>qrCodeText</code>
              </p>
              <p>
                4. Se o QR code não aparecer, verifique os logs do console para mais detalhes
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DebugQrCodePage; 