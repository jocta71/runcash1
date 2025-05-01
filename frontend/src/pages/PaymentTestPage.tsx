import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Alert, Button, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import simulatedApi from './api/simulateApi';

// Função para obter parâmetros da URL
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const PaymentTestPage: React.FC = () => {
  const navigate = useNavigate();
  const query = useQuery();
  
  // Parâmetros da URL
  const paymentId = query.get('paymentId');
  const subscriptionId = query.get('subscriptionId');
  
  // Estados
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  
  // Carregar detalhes do pagamento
  useEffect(() => {
    if (paymentId && subscriptionId) {
      loadPaymentDetails();
    }
  }, [paymentId, subscriptionId]);
  
  // Função para carregar detalhes do pagamento
  const loadPaymentDetails = async () => {
    try {
      // Em uma aplicação real, faríamos uma chamada de API aqui
      // Simulação simples para testes
      const data = simulatedApi.loadDatabase();
      
      // Buscar pagamento no banco de dados simulado
      const testDatabase = JSON.parse(localStorage.getItem('subscription_test_database') || '{}');
      const payment = testDatabase.payments?.find((p: any) => p.id === paymentId);
      const subscription = testDatabase.subscriptions?.find((s: any) => s.id === subscriptionId);
      
      if (payment && subscription) {
        setPaymentDetails({
          payment,
          subscription,
          plan: subscription.planId
        });
      } else {
        setError('Pagamento ou assinatura não encontrados');
      }
    } catch (err: any) {
      console.error('Erro ao carregar detalhes:', err);
      setError(err.message || 'Erro ao carregar detalhes do pagamento');
    }
  };
  
  // Função para aprovar pagamento
  const handleApprovePayment = async () => {
    if (!subscriptionId) {
      setError('ID da assinatura não informado');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await simulatedApi.approvePayment(subscriptionId);
      
      if (result.success) {
        setSuccess('Pagamento aprovado com sucesso! Assinatura ativada.');
        
        // Recarregar detalhes
        loadPaymentDetails();
        
        // Redirecionar após 3 segundos
        setTimeout(() => {
          navigate('/subscription-test');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Erro ao aprovar pagamento:', err);
      setError(err.message || 'Erro ao aprovar pagamento');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para cancelar pagamento
  const handleCancelPayment = () => {
    navigate('/subscription-test');
  };
  
  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-primary text-white">
              <h2 className="h4 mb-0">Pagamento de Assinatura</h2>
            </Card.Header>
            <Card.Body>
              {error && (
                <Alert variant="danger" className="mb-4">
                  {error}
                </Alert>
              )}
              
              {success && (
                <Alert variant="success" className="mb-4">
                  {success}
                </Alert>
              )}
              
              <div className="text-center mb-4">
                <img 
                  src="/assets/payment-icon.png" 
                  alt="Pagamento"
                  style={{ maxWidth: '120px' }}
                  onError={(e) => {
                    // Fallback se a imagem não existir
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              
              <h3 className="text-center mb-4">Simulação de Pagamento</h3>
              
              {paymentDetails ? (
                <div className="mb-4">
                  <Alert variant="info">
                    <h5>Detalhes do Pagamento</h5>
                    <p className="mb-1"><strong>Plano:</strong> {paymentDetails.plan?.toUpperCase()}</p>
                    <p className="mb-1"><strong>Valor:</strong> R$ {paymentDetails.payment?.value?.toFixed(2)}</p>
                    <p className="mb-1">
                      <strong>Status:</strong>{' '}
                      <span className={paymentDetails.payment?.status === 'CONFIRMED' ? 'text-success' : 'text-warning'}>
                        {paymentDetails.payment?.status === 'CONFIRMED' ? 'CONFIRMADO' : 'PENDENTE'}
                      </span>
                    </p>
                    <p className="mb-0"><strong>ID:</strong> {paymentDetails.payment?.id}</p>
                  </Alert>
                  
                  <Alert variant="light" className="text-center">
                    <p className="mb-0">
                      Esta é uma <strong>simulação de pagamento</strong> para ambiente de testes.<br />
                      Em um ambiente real, aqui seria a página de checkout do provedor de pagamentos.
                    </p>
                  </Alert>
                </div>
              ) : (
                <div className="text-center mb-4">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Carregando...</span>
                  </Spinner>
                  <p className="mt-2">Carregando detalhes do pagamento...</p>
                </div>
              )}
              
              {paymentDetails && paymentDetails.payment?.status !== 'CONFIRMED' && (
                <div className="d-grid gap-2">
                  <Button 
                    variant="success" 
                    size="lg" 
                    onClick={handleApprovePayment}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Processando...
                      </>
                    ) : 'Aprovar Pagamento'}
                  </Button>
                  
                  <Button 
                    variant="outline-secondary" 
                    onClick={handleCancelPayment}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
              
              {paymentDetails && paymentDetails.payment?.status === 'CONFIRMED' && (
                <div className="text-center">
                  <Alert variant="success">
                    <h5>Pagamento Aprovado!</h5>
                    <p className="mb-0">Sua assinatura está ativa.</p>
                  </Alert>
                  
                  <Button 
                    variant="primary" 
                    onClick={() => navigate('/subscription-test')}
                  >
                    Voltar para a Página de Teste
                  </Button>
                </div>
              )}
            </Card.Body>
            <Card.Footer className="text-center text-muted small">
              <p className="mb-0">Este é um ambiente de testes. Nenhum pagamento real será processado.</p>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default PaymentTestPage; 