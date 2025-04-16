import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createAsaasSubscription, findAsaasPayment } from '../integrations/asaas/client';
import PaymentPixModal from '../components/PaymentPixModal';
import PaymentStatusChecker from '../components/PaymentStatusChecker';
import { Alert, Button, Card, Container, Row, Col, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

/**
 * Página de pagamento via Asaas
 * Esta página gerencia o fluxo completo de pagamento:
 * 1. Exibe o modal de pagamento PIX quando necessário
 * 2. Permite verificar o status do pagamento
 * 3. Exibe o resultado do pagamento
 */
const AsaasPaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Obter parâmetros da URL
  const queryParams = new URLSearchParams(location.search);
  const planId = queryParams.get('planId');
  const customerId = queryParams.get('customerId');
  const returnUrl = queryParams.get('returnUrl') || '/account';
  const paymentMethod = queryParams.get('paymentMethod') || 'PIX';
  
  // Estados
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [showPixModal, setShowPixModal] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isVerifyingStatus, setIsVerifyingStatus] = useState<boolean>(false);

  // Efeito para iniciar o processo de pagamento quando a página carrega
  useEffect(() => {
    if (planId && customerId && user) {
      createPayment();
    }
  }, [planId, customerId, user]);

  // Função para criar o pagamento/assinatura
  const createPayment = async () => {
    if (!planId || !customerId || !user) {
      setError('Dados incompletos para iniciar o pagamento. Verifique se você está logado e tente novamente.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Criar assinatura no Asaas
      const result = await createAsaasSubscription(
        planId, 
        user.id, 
        customerId, 
        paymentMethod
      );
      
      // Se for assinatura gratuita, redirecionar diretamente
      if (result.status === 'ACTIVE' || planId === 'free') {
        navigate(`/payment-success?plan=${planId}`);
        return;
      }
      
      // Guardar IDs para referência
      setPaymentId(result.paymentId);
      setSubscriptionId(result.subscriptionId);
      
      // Se for PIX e tiver paymentId, mostrar modal do PIX
      if (paymentMethod === 'PIX' && result.paymentId) {
        setShowPixModal(true);
      } 
      // Se for cartão de crédito e tiver redirectUrl, redirecionar
      else if (paymentMethod === 'CREDIT_CARD' && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
      // Caso contrário, mostrar erro
      else {
        setError('Não foi possível obter as informações de pagamento.');
      }
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
      setError(error instanceof Error ? error.message : 'Ocorreu um erro ao processar o pagamento.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para verificar o status do pagamento manualmente
  const checkPaymentStatus = async () => {
    if (!paymentId) {
      setError('ID do pagamento não disponível.');
      return;
    }
    
    setIsVerifyingStatus(true);
    try {
      const payment = await findAsaasPayment(paymentId);
      setPaymentStatus(payment.status);
      
      // Se o pagamento foi confirmado, redirecionar para página de sucesso
      if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
        setTimeout(() => {
          navigate(`/payment-success?plan=${planId}`);
        }, 2000); // Aguardar 2 segundos para mostrar o status
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setError('Não foi possível verificar o status do pagamento.');
    } finally {
      setIsVerifyingStatus(false);
    }
  };

  // Callback para quando o pagamento for confirmado pelo PaymentPixModal ou PaymentStatusChecker
  const handlePaymentSuccess = () => {
    setPaymentStatus('CONFIRMED');
    setTimeout(() => {
      navigate(`/payment-success?plan=${planId}`);
    }, 2000);
  };

  // Renderizar página de carregamento
  if (isLoading) {
    return (
      <Container className="my-5 text-center">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <p>Preparando seu pagamento...</p>
      </Container>
    );
  }

  return (
    <Container className="my-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card>
            <Card.Header className="bg-dark text-white">
              <h4 className="mb-0">Pagamento - Plano {planId}</h4>
            </Card.Header>
            <Card.Body>
              {error && (
                <Alert variant="danger" className="mb-4">
                  {error}
                  <div className="mt-2">
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      onClick={() => createPayment()}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                </Alert>
              )}
              
              {paymentId && !showPixModal && (
                <>
                  <div className="mb-4">
                    <h5>Status do pagamento</h5>
                    {paymentStatus ? (
                      <Alert variant={
                        paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED' 
                          ? 'success' 
                          : paymentStatus === 'PENDING' 
                            ? 'info' 
                            : 'warning'
                      }>
                        {paymentStatus === 'CONFIRMED' || paymentStatus === 'RECEIVED' 
                          ? 'Pagamento confirmado!' 
                          : paymentStatus === 'PENDING' 
                            ? 'Aguardando pagamento' 
                            : `Status: ${paymentStatus}`
                        }
                      </Alert>
                    ) : (
                      <p>Clique no botão abaixo para verificar o status</p>
                    )}
                  </div>
                  
                  <div className="d-grid gap-2">
                    <Button 
                      variant="primary" 
                      onClick={() => setShowPixModal(true)}
                      disabled={
                        paymentStatus === 'CONFIRMED' || 
                        paymentStatus === 'RECEIVED'
                      }
                    >
                      Mostrar QR Code PIX
                    </Button>
                    
                    <Button 
                      variant="outline-primary" 
                      onClick={checkPaymentStatus}
                      disabled={isVerifyingStatus}
                    >
                      {isVerifyingStatus ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            className="me-2"
                          />
                          Verificando...
                        </>
                      ) : 'Verificar status do pagamento'}
                    </Button>
                    
                    <Button 
                      variant="outline-secondary"
                      onClick={() => navigate(returnUrl)}
                    >
                      Voltar
                    </Button>
                  </div>
                </>
              )}
              
              {!paymentId && !error && !isLoading && (
                <div className="text-center">
                  <p>Nenhum pagamento em andamento.</p>
                  <Button 
                    variant="primary" 
                    onClick={() => navigate('/plans')}
                  >
                    Ver planos disponíveis
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Modal para exibir o QR Code PIX */}
      {paymentId && (
        <PaymentPixModal
          show={showPixModal}
          onHide={() => setShowPixModal(false)}
          paymentId={paymentId}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
      
      {/* Verificador de status em background */}
      {paymentId && !showPixModal && !paymentStatus && (
        <div style={{ display: 'none' }}>
          <PaymentStatusChecker
            paymentId={paymentId}
            onPaymentConfirmed={handlePaymentSuccess}
            checkInterval={15000}
          />
        </div>
      )}
    </Container>
  );
};

export default AsaasPaymentPage; 