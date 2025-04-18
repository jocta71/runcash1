import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Alert, Button, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CustomerForm from '../components/CustomerForm';
import PaymentPixModal from '../components/PaymentPixModal';
import { createAsaasSubscription } from '../integrations/asaas/client';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  
  // Obter parâmetros da URL
  const queryParams = new URLSearchParams(location.search);
  const planId = queryParams.get('planId');
  const planName = queryParams.get('planName');
  const planPrice = queryParams.get('planPrice');
  
  // Estados
  const [step, setStep] = useState<number>(1);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [showPixModal, setShowPixModal] = useState<boolean>(false);
  
  // Verificar se o usuário está autenticado e se o plano foi especificado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=' + encodeURIComponent(location.pathname + location.search));
    }
    
    if (!planId) {
      navigate('/plans');
    }
  }, [user, authLoading, planId, navigate, location]);
  
  // Manipulador para quando um cliente é criado ou selecionado
  const handleCustomerSelected = (id: string) => {
    setCustomerId(id);
    setStep(2);
  };
  
  // Criar assinatura
  const handleCreateSubscription = async () => {
    if (!customerId || !planId || !user) {
      setError('Dados incompletos para criar assinatura.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await createAsaasSubscription(
        planId,
        user.id,
        customerId,
        paymentMethod
      );
      
      setSubscriptionId(result.subscriptionId);
      setPaymentId(result.paymentId);
      
      // Se for assinatura gratuita ou já ativa, redirecionar para sucesso
      if (result.status === 'ACTIVE' || planId === 'free') {
        navigate('/payment-success?plan=' + planId);
        return;
      }
      
      // Se for PIX, mostrar modal do QR code
      if (paymentMethod === 'PIX' && result.paymentId) {
        setShowPixModal(true);
      } 
      // Se tiver URL de redirecionamento, redirecionar
      else if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
      
      setStep(3);
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      setError(error instanceof Error ? error.message : 'Erro ao criar assinatura.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Manipulador para quando o pagamento é confirmado
  const handlePaymentSuccess = () => {
    navigate('/payment-success?plan=' + planId);
  };
  
  // Se ainda estiver carregando dados de autenticação ou não tiver usuário ou plano, mostrar carregando
  if (authLoading || !user || !planId) {
    return (
      <Container className="my-5 text-center">
        <Spinner animation="border" />
        <p>Carregando...</p>
      </Container>
    );
  }
  
  return (
    <Container className="my-5">
      <h2 className="mb-4">Checkout</h2>
      
      {/* Resumo do plano */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="h-100">
            <Card.Header className="bg-dark text-white">
              <h5 className="mb-0">Resumo do Pedido</h5>
            </Card.Header>
            <Card.Body>
              <h5>{planName || `Plano ${planId}`}</h5>
              {planPrice && (
                <p className="mb-1">
                  <strong>Valor:</strong> R$ {parseFloat(planPrice).toFixed(2).replace('.', ',')}
                </p>
              )}
              <p className="mb-0">
                <strong>ID do Plano:</strong> {planId}
              </p>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={8}>
          {/* Passo 1: Selecionar/Criar Cliente */}
          {step === 1 && (
            <Card>
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">Passo 1: Dados do Cliente</h5>
              </Card.Header>
              <Card.Body>
                <CustomerForm 
                  onCustomerCreated={handleCustomerSelected}
                  onCustomerSelected={handleCustomerSelected}
                />
              </Card.Body>
            </Card>
          )}
          
          {/* Passo 2: Selecionar Método de Pagamento */}
          {step === 2 && (
            <Card>
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">Passo 2: Método de Pagamento</h5>
              </Card.Header>
              <Card.Body>
                <div className="mb-4">
                  <h5>Escolha como deseja pagar:</h5>
                  
                  <div className="payment-methods">
                    <div 
                      className={`payment-method-item ${paymentMethod === 'PIX' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('PIX')}
                    >
                      <div className="payment-method-icon">🔄</div>
                      <div className="payment-method-text">
                        <h6>PIX</h6>
                        <p className="mb-0">Pagamento instantâneo</p>
                      </div>
                    </div>
                    
                    <div 
                      className={`payment-method-item ${paymentMethod === 'CREDIT_CARD' ? 'active' : ''}`}
                      onClick={() => setPaymentMethod('CREDIT_CARD')}
                    >
                      <div className="payment-method-icon">💳</div>
                      <div className="payment-method-text">
                        <h6>Cartão de Crédito</h6>
                        <p className="mb-0">Pagamento recorrente automático</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {error && (
                  <Alert variant="danger" className="mb-3">
                    {error}
                  </Alert>
                )}
                
                <div className="d-flex justify-content-between">
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => setStep(1)}
                  >
                    Voltar
                  </Button>
                  
                  <Button 
                    variant="primary" 
                    onClick={handleCreateSubscription}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Processando...
                      </>
                    ) : 'Finalizar Compra'}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
          
          {/* Passo 3: Confirmação de Pagamento */}
          {step === 3 && (
            <Card>
              <Card.Header className="bg-primary text-white">
                <h5 className="mb-0">Passo 3: Confirmação de Pagamento</h5>
              </Card.Header>
              <Card.Body className="text-center">
                <h5 className="mb-3">Assinatura criada com sucesso!</h5>
                
                {paymentMethod === 'PIX' && (
                  <div>
                    <p>Para ativar sua assinatura, conclua o pagamento via PIX.</p>
                    <Button 
                      variant="primary" 
                      onClick={() => setShowPixModal(true)}
                      className="mb-3"
                    >
                      Mostrar QR Code PIX
                    </Button>
                  </div>
                )}
                
                {paymentMethod === 'CREDIT_CARD' && (
                  <div>
                    <p>Você será redirecionado para a página de pagamento para concluir sua assinatura.</p>
                    <Spinner animation="border" />
                  </div>
                )}
                
                <div className="mt-3">
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => navigate('/account')}
                  >
                    Ir para Minha Conta
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
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
      
      <style jsx>{`
        .payment-methods {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .payment-method-item {
          display: flex;
          align-items: center;
          padding: 1rem;
          border: 1px solid #dee2e6;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .payment-method-item.active {
          border-color: #0d6efd;
          background-color: rgba(13, 110, 253, 0.1);
        }
        
        .payment-method-item:hover {
          border-color: #0d6efd;
        }
        
        .payment-method-icon {
          font-size: 1.5rem;
          margin-right: 1rem;
        }
        
        .payment-method-text {
          flex: 1;
        }
        
        .payment-method-text h6 {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </Container>
  );
};

export default CheckoutPage; 