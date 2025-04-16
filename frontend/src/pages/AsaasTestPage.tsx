import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { createAsaasCustomer, createAsaasSubscription, findAsaasPayment, cancelAsaasSubscription } from '../integrations/asaas/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AsaasTestPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Estados para os formulários
  const [customerId, setCustomerId] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [subscriptionIdToCancel, setSubscriptionIdToCancel] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CREDIT_CARD');
  
  // Estados para resultados e erros
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customerResult, setCustomerResult] = useState<any>(null);
  const [subscriptionResult, setSubscriptionResult] = useState<any>(null);
  const [cancelResult, setCancelResult] = useState<any>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Verificar autenticação
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/test');
    }
  }, [user, authLoading, navigate]);

  // Se ainda está carregando ou não as duashá usuário, mostrar loading
  if (authLoading || !user) {
    return (
      <Container className="my-4 text-center">
        <Spinner animation="border" />
        <p>Carregando...</p>
      </Container>
    );
  }
  
  // Criar cliente
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setCustomerResult(null);
    
    try {
      const result = await createAsaasCustomer({
        name,
        email,
        cpfCnpj: cpf.replace(/\D/g, ''),
        mobilePhone: phone.replace(/\D/g, ''),
        userId: user.id
      });
      
      setCustomerResult({ id: result });
      setCustomerId(result);
    } catch (err) {
      console.error('Erro ao criar cliente:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar cliente');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Criar assinatura
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError('ID do cliente é necessário');
      return;
    }
    
    if (!planId) {
      setError('ID do plano é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSubscriptionResult(null);
    
    try {
      const result = await createAsaasSubscription(
        planId,
        user?.id || 'test-user',
        customerId,
        paymentMethod
      );
      
      setSubscriptionResult(result);
      if (result.paymentId) {
        setPaymentId(result.paymentId);
      }
      
      // Se tiver um ID de assinatura, copiar para o campo de cancelamento
      if (result.subscriptionId) {
        setSubscriptionIdToCancel(result.subscriptionId);
      }
    } catch (err) {
      console.error('Erro ao criar assinatura:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar assinatura');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verificar pagamento
  const handleCheckPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentId) {
      setError('ID do pagamento é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPaymentResult(null);
    
    try {
      const result = await findAsaasPayment(paymentId);
      setPaymentResult(result);
    } catch (err) {
      console.error('Erro ao verificar pagamento:', err);
      setError(err instanceof Error ? err.message : 'Erro ao verificar pagamento');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Cancelar assinatura
  const handleCancelSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionIdToCancel) {
      setError('ID da assinatura é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCancelResult(null);
    
    try {
      const result = await cancelAsaasSubscription(subscriptionIdToCancel);
      setCancelResult(result);
    } catch (err) {
      console.error('Erro ao cancelar assinatura:', err);
      setError(err instanceof Error ? err.message : 'Erro ao cancelar assinatura');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Ir para a página de pagamento
  const handleGoToPaymentPage = () => {
    if (!customerId || !planId) {
      setError('ID do cliente e ID do plano são necessários');
      return;
    }
    
    navigate(`/payment?planId=${planId}&customerId=${customerId}&paymentMethod=${paymentMethod}`);
  };
  
  return (
    <Container className="my-4">
      <h2 className="mb-4">Página de Teste - Integração Asaas</h2>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      <Row>
        <Col md={6} className="mb-4">
          <Card>
            <Card.Header>
              <h5 className="mb-0">Criar Cliente</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleCreateCustomer}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome Completo</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>CPF (apenas números)</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={cpf} 
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, ''))}
                    required
                    maxLength={11}
                    minLength={11}
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Telefone</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </Form.Group>
                
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Processando...
                    </>
                  ) : 'Criar Cliente'}
                </Button>
              </Form>
              
              {customerResult && (
                <div className="mt-3">
                  <Alert variant="success">
                    Cliente criado com sucesso!
                  </Alert>
                  <div className="small mt-2">
                    <strong>ID do Cliente:</strong> {customerResult.id}<br />
                    <Button 
                      variant="outline-secondary" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => {
                        navigator.clipboard.writeText(customerResult.id);
                        alert('ID copiado!');
                      }}
                    >
                      Copiar ID
                    </Button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <Card className="mt-4">
            <Card.Header>
              <h5 className="mb-0">Cancelar Assinatura</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleCancelSubscription}>
                <Form.Group className="mb-3">
                  <Form.Label>ID da Assinatura</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={subscriptionIdToCancel} 
                    onChange={(e) => setSubscriptionIdToCancel(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  variant="danger"
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Cancelando...
                    </>
                  ) : 'Cancelar Assinatura'}
                </Button>
              </Form>
              
              {cancelResult && (
                <div className="mt-3">
                  <Alert variant="success">
                    Assinatura cancelada com sucesso!
                  </Alert>
                  <div className="small mt-2">
                    <pre className="p-2 bg-light rounded">
                      {JSON.stringify(cancelResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6} className="mb-4">
          <Card>
            <Card.Header>
              <h5 className="mb-0">Criar Assinatura</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleCreateSubscription}>
                <Form.Group className="mb-3">
                  <Form.Label>ID do Cliente</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={customerId} 
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>ID do Plano</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={planId} 
                    onChange={(e) => setPlanId(e.target.value)}
                    required
                  />
                  <Form.Text className="text-muted">
                    Exemplos: basic, pro, premium
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Método de Pagamento</Form.Label>
                  <Form.Control
                    as="select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                  >
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="PIX">PIX</option>
                  </Form.Control>
                  <Form.Text className="text-muted">
                    Escolha como deseja pagar sua assinatura
                  </Form.Text>
                </Form.Group>
                
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Processando...
                    </>
                  ) : 'Criar Assinatura'}
                </Button>
              </Form>
              
              {subscriptionResult && (
                <div className="mt-3">
                  <Alert variant="success">
                    Assinatura criada com sucesso!
                  </Alert>
                  <div className="small mt-2">
                    <strong>ID da Assinatura:</strong> {subscriptionResult.subscriptionId}<br />
                    {subscriptionResult.paymentId && (
                      <>
                        <strong>ID do Pagamento:</strong> {subscriptionResult.paymentId}<br />
                        <Button 
                          variant="outline-secondary" 
                          size="sm" 
                          className="mt-2 me-2"
                          onClick={() => {
                            navigator.clipboard.writeText(subscriptionResult.paymentId);
                            alert('ID copiado!');
                          }}
                        >
                          Copiar ID do Pagamento
                        </Button>
                        <Button 
                          variant="primary" 
                          size="sm" 
                          className="mt-2"
                          onClick={handleGoToPaymentPage}
                        >
                          Ir para Página de Pagamento
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <Card className="mt-4">
            <Card.Header>
              <h5 className="mb-0">Verificar Pagamento</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleCheckPayment}>
                <Form.Group className="mb-3">
                  <Form.Label>ID do Pagamento</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={paymentId} 
                    onChange={(e) => setPaymentId(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Verificando...
                    </>
                  ) : 'Verificar Pagamento'}
                </Button>
              </Form>
              
              {paymentResult && (
                <div className="mt-3">
                  <Alert 
                    variant={
                      paymentResult.status === 'CONFIRMED' || paymentResult.status === 'RECEIVED' 
                        ? 'success' 
                        : paymentResult.status === 'PENDING' 
                          ? 'info' 
                          : 'warning'
                    }
                  >
                    Status do Pagamento: <strong>{paymentResult.status}</strong>
                  </Alert>
                  <div className="small mt-2">
                    <pre className="p-2 bg-light rounded">
                      {JSON.stringify(paymentResult, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <Row className="mt-4">
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Fluxo completo de teste</h5>
            </Card.Header>
            <Card.Body>
              <ol>
                <li>Crie um cliente usando o formulário "Criar Cliente"</li>
                <li>Copie o ID do cliente retornado</li>
                <li>Use esse ID no formulário "Criar Assinatura" junto com um ID de plano (ex: basic)</li>
                <li>Copie o ID do pagamento retornado</li>
                <li>Use esse ID no formulário "Verificar Pagamento" para conferir o status</li>
                <li>Você também pode cancelar uma assinatura usando o formulário "Cancelar Assinatura"</li>
                <li>Ou acesse a página de pagamento diretamente em: <code>/payment?planId=ID_DO_PLANO&customerId=ID_DO_CLIENTE</code></li>
              </ol>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AsaasTestPage; 