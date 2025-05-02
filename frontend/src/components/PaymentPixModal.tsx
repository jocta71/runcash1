import React, { useEffect, useState } from 'react';
import { Modal, Button, Spinner, Alert } from 'react-bootstrap';
import { getAsaasPixQrCode, findAsaasPayment } from '../integrations/asaas/client';

type PaymentPixModalProps = {
  show: boolean;
  onHide: () => void;
  paymentId: string;
  onPaymentSuccess?: () => void;
};

const PaymentPixModal: React.FC<PaymentPixModalProps> = ({ 
  show, 
  onHide,
  paymentId,
  onPaymentSuccess
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCodeText, setQrCodeText] = useState<string | null>(null);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (show && paymentId) {
      loadQrCode();
      
      // Iniciar polling para verificar status do pagamento
      const interval = setInterval(() => {
        checkPaymentStatus();
      }, 10000); // Verificar a cada 10 segundos
      
      setPollingInterval(interval);
    }
    
    return () => {
      // Limpar intervalo ao desmontar o componente
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [show, paymentId]);

  const loadQrCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pixData = await getAsaasPixQrCode(paymentId);
      
      setQrCodeImage(pixData.qrCodeImage);
      setQrCodeText(pixData.qrCodeText);
      setExpirationDate(pixData.expirationDate || null);
      
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError('Não foi possível carregar o QR Code PIX. Tente novamente.');
      console.error('Erro ao carregar QR Code PIX:', error);
    }
  };

  const checkPaymentStatus = async () => {
    try {
      const payment = await findAsaasPayment(paymentId);
      
      // Se o pagamento foi confirmado
      if (payment && (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED')) {
        // Parar o polling
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        // Executar callback de sucesso
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
        
        // Fechar o modal
        onHide();
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
    }
  };

  // Função para copiar o código PIX para a área de transferência
  const copyPIXCode = () => {
    if (qrCodeText) {
      navigator.clipboard.writeText(qrCodeText)
        .then(() => {
          alert('Código PIX copiado para a área de transferência!');
        })
        .catch(err => {
          console.error('Erro ao copiar código:', err);
        });
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Pagamento via PIX</Modal.Title>
      </Modal.Header>
      <Modal.Body className="text-center">
        {loading && (
          <div className="d-flex justify-content-center my-4">
            <Spinner animation="border" variant="primary" />
            <span className="ms-2">Carregando QR Code...</span>
          </div>
        )}
        
        {error && (
          <Alert variant="danger">
            {error}
            <div className="mt-2">
              <Button variant="outline-primary" onClick={loadQrCode}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        )}
        
        {!loading && !error && qrCodeImage && (
          <div>
            <p>Escaneie o QR Code abaixo com o aplicativo do seu banco para fazer o pagamento:</p>
            
            <div className="my-4">
              <img 
                src={`data:image/png;base64,${qrCodeImage}`} 
                alt="QR Code PIX" 
                style={{ maxWidth: '250px' }} 
              />
            </div>
            
            <div className="my-3">
              <p><strong>Ou utilize o código PIX copia e cola:</strong></p>
              <div className="d-flex justify-content-center">
                <div 
                  className="border p-2 rounded bg-light text-break" 
                  style={{ maxWidth: '450px', wordWrap: 'break-word' }}
                >
                  {qrCodeText}
                </div>
              </div>
              <Button 
                variant="outline-primary" 
                size="sm" 
                className="mt-2"
                onClick={copyPIXCode}
              >
                Copiar código
              </Button>
            </div>
            
            {expirationDate && (
              <Alert variant="warning" className="mt-3">
                <small>Este QR Code expira em: {new Date(expirationDate).toLocaleString()}</small>
              </Alert>
            )}
            
            <Alert variant="info" className="mt-3">
              <p className="mb-0">Após o pagamento, esta janela será atualizada automaticamente.</p>
              <small>Não feche esta janela até a confirmação do pagamento.</small>
            </Alert>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Fechar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PaymentPixModal; 