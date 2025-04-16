import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Tabs, Tab, Badge } from 'react-bootstrap';
import { createAsaasCustomer, createAsaasSubscription, findAsaasPayment } from '../integrations/asaas/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Interface para assinatura
interface Subscription {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  status: string;
  billingType: string;
}

// Interface para pagamento
interface Payment {
  id: string;
  customer: string;
  value: number;
  dueDate: string;
  status: string;
  billingType: string;
}

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
  const [paymentMethod, setPaymentMethod] = useState<string>('CREDIT_CARD');
  const [subscriptionId, setSubscriptionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('create-customer');
  
  // Novos estados para assinaturas e pagamentos
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [failureReason, setFailureReason] = useState<string>('');
  
  // Estados para resultados e erros
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customerResult, setCustomerResult] = useState<any>(null);
  const [subscriptionResult, setSubscriptionResult] = useState<any>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Verificar autenticação
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/asaas-test');
    }
  }, [user, authLoading, navigate]);

  // Se ainda está carregando ou não há usuário, mostrar loading
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
      if (result.subscriptionId) {
        setSubscriptionId(result.subscriptionId);
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
  
  // Ir para a página de pagamento
  const handleGoToPaymentPage = () => {
    if (!customerId || !planId) {
      setError('ID do cliente e ID do plano são necessários');
      return;
    }
    
    navigate(`/payment?planId=${planId}&customerId=${customerId}&paymentMethod=${paymentMethod}`);
  };

  // Listar assinaturas de um cliente
  const handleListSubscriptions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerSearch) {
      setError('ID do cliente é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/asaas-list-subscriptions?customerId=${customerSearch}`);
      
      if (response.data.success) {
        setSubscriptions(response.data.data || []);
      } else {
        throw new Error(response.data.error || 'Erro ao listar assinaturas');
      }
    } catch (err) {
      console.error('Erro ao listar assinaturas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao listar assinaturas');
      setSubscriptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancelar assinatura
  const handleCancelSubscription = async () => {
    if (!subscriptionId) {
      setError('ID da assinatura é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/asaas-cancel-subscription', {
        subscriptionId
      });
      
      if (response.data.success) {
        setSubscriptionResult({
          ...subscriptionResult,
          status: 'CANCELLED',
          message: 'Assinatura cancelada com sucesso'
        });
      } else {
        throw new Error(response.data.error || 'Erro ao cancelar assinatura');
      }
    } catch (err) {
      console.error('Erro ao cancelar assinatura:', err);
      setError(err instanceof Error ? err.message : 'Erro ao cancelar assinatura');
    } finally {
      setIsLoading(false);
    }
  };

  // Simular falha de pagamento
  const handleSimulateFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentId) {
      setError('ID do pagamento é necessário');
      return;
    }
    
    if (!failureReason) {
      setError('Motivo da falha é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/asaas-simulate-failure', {
        paymentId,
        reason: failureReason
      });
      
      if (response.data.success) {
        setPaymentResult({
          ...paymentResult,
          status: 'FAILED',
          failureReason: failureReason
        });
        setError('Falha de pagamento simulada com sucesso');
      } else {
        throw new Error(response.data.error || 'Erro ao simular falha');
      }
    } catch (err) {
      console.error('Erro ao simular falha:', err);
      setError(err instanceof Error ? err.message : 'Erro ao simular falha de pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  // Listar pagamentos de um cliente
  const handleListPayments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerSearch) {
      setError('ID do cliente é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/asaas-list-payments?customerId=${customerSearch}`);
      
      if (response.data.success) {
        setPayments(response.data.data || []);
      } else {
        throw new Error(response.data.error || 'Erro ao listar pagamentos');
      }
    } catch (err) {
      console.error('Erro ao listar pagamentos:', err);
      setError(err instanceof Error ? err.message : 'Erro ao listar pagamentos');
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar status do pagamento com badge colorido
  const renderPaymentStatus = (status: string) => {
    let variant = 'secondary';
    
    switch (status) {
      case 'CONFIRMED':
      case 'RECEIVED':
        variant = 'success';
        break;
      case 'PENDING':
        variant = 'info';
        break;
      case 'OVERDUE':
        variant = 'danger';
        break;
      case 'REFUNDED':
        variant = 'warning';
        break;
      default:
        variant = 'secondary';
    }
    
    return <Badge bg={variant}>{status}</Badge>;
  };
  
  return (
    <Container className="my-4">
      <h2 className="mb-4">Página de Teste - Integração Asaas</h2>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || 'create-customer')}
        className="mb-4"
      >
        <Tab eventKey="create-customer" title="Criar Cliente">
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
        </Tab>

        <Tab eventKey="create-subscription" title="Criar Assinatura">
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
                    <option value="BOLETO">Boleto</option>
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
                          className="mt-2 me-2"
                          onClick={handleGoToPaymentPage}
                        >
                          Ir para Página de Pagamento
                        </Button>
                        <Button 
                          variant="danger" 
                          size="sm" 
                          className="mt-2"
                          onClick={handleCancelSubscription}
                        >
                          Cancelar Assinatura
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="check-payment" title="Verificar Pagamento">
          <Card>
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
        </Tab>

        <Tab eventKey="list-subscriptions" title="Listar Assinaturas">
          <Card>
            <Card.Header>
              <h5 className="mb-0">Listar Assinaturas do Cliente</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleListSubscriptions}>
                <Form.Group className="mb-3">
                  <Form.Label>ID do Cliente</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={customerSearch} 
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Buscando...
                    </>
                  ) : 'Listar Assinaturas'}
                </Button>
              </Form>
              
              {subscriptions.length > 0 && (
                <div className="mt-3">
                  <h6>Assinaturas Encontradas: {subscriptions.length}</h6>
                  {subscriptions.map((sub) => (
                    <Card key={sub.id} className="mb-2 small">
                      <Card.Body>
                        <Row>
                          <Col xs={8}>
                            <p><strong>ID:</strong> {sub.id}</p>
                            <p><strong>Valor:</strong> R$ {sub.value.toFixed(2)}</p>
                            <p><strong>Próx. Cobrança:</strong> {new Date(sub.nextDueDate).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> {renderPaymentStatus(sub.status)}</p>
                          </Col>
                          <Col xs={4} className="text-end">
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              className="mb-2"
                              onClick={() => {
                                setSubscriptionId(sub.id);
                                setActiveTab('create-subscription');
                                setSubscriptionResult({ subscriptionId: sub.id });
                              }}
                            >
                              Selecionar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-danger"
                              onClick={() => {
                                setSubscriptionId(sub.id);
                                handleCancelSubscription();
                              }}
                            >
                              Cancelar
                            </Button>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
              
              {subscriptions.length === 0 && !isLoading && customerSearch && (
                <Alert variant="info" className="mt-3">
                  Nenhuma assinatura encontrada para este cliente.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="list-payments" title="Listar Pagamentos">
          <Card>
            <Card.Header>
              <h5 className="mb-0">Listar Pagamentos do Cliente</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleListPayments}>
                <Form.Group className="mb-3">
                  <Form.Label>ID do Cliente</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={customerSearch} 
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Buscando...
                    </>
                  ) : 'Listar Pagamentos'}
                </Button>
              </Form>
              
              {payments.length > 0 && (
                <div className="mt-3">
                  <h6>Pagamentos Encontrados: {payments.length}</h6>
                  {payments.map((payment) => (
                    <Card key={payment.id} className="mb-2 small">
                      <Card.Body>
                        <Row>
                          <Col xs={8}>
                            <p><strong>ID:</strong> {payment.id}</p>
                            <p><strong>Valor:</strong> R$ {payment.value.toFixed(2)}</p>
                            <p><strong>Vencimento:</strong> {new Date(payment.dueDate).toLocaleDateString()}</p>
                            <p><strong>Status:</strong> {renderPaymentStatus(payment.status)}</p>
                          </Col>
                          <Col xs={4} className="text-end">
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              onClick={() => {
                                setPaymentId(payment.id);
                                setActiveTab('check-payment');
                                handleCheckPayment(new Event('click') as any);
                              }}
                            >
                              Verificar
                            </Button>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
              
              {payments.length === 0 && !isLoading && customerSearch && (
                <Alert variant="info" className="mt-3">
                  Nenhum pagamento encontrado para este cliente.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="simulate-failure" title="Simular Falhas">
          <Card>
            <Card.Header>
              <h5 className="mb-0">Simular Falha de Pagamento</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSimulateFailure}>
                <Form.Group className="mb-3">
                  <Form.Label>ID do Pagamento</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={paymentId} 
                    onChange={(e) => setPaymentId(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Motivo da Falha</Form.Label>
                  <Form.Control
                    as="select"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    required
                  >
                    <option value="">Selecione um motivo</option>
                    <option value="INSUFFICIENT_FUNDS">Saldo Insuficiente</option>
                    <option value="CREDIT_CARD_EXPIRED">Cartão Expirado</option>
                    <option value="TRANSACTION_DECLINED">Transação Recusada</option>
                    <option value="PROCESSING_ERROR">Erro de Processamento</option>
                  </Form.Control>
                </Form.Group>
                
                <Button type="submit" disabled={isLoading} variant="warning">
                  {isLoading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Processando...
                    </>
                  ) : 'Simular Falha'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
      
      <Row className="mt-4">
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Fluxo completo de teste</h5>
            </Card.Header>
            <Card.Body>
              <ol>
                <li>Crie um cliente usando a aba "Criar Cliente"</li>
                <li>Copie o ID do cliente retornado</li>
                <li>Use esse ID na aba "Criar Assinatura" junto com um ID de plano (ex: basic)</li>
                <li>Copie o ID do pagamento retornado</li>
                <li>Use esse ID na aba "Verificar Pagamento" para conferir o status</li>
                <li>Teste listar as assinaturas e pagamentos do cliente na aba "Listar Assinaturas"</li>
                <li>Se desejar, cancele a assinatura ou simule falhas de pagamento nas abas correspondentes</li>
              </ol>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AsaasTestPage; 