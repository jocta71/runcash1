import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge, Table, Modal, Form, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  cancelAsaasSubscription, 
  findAsaasPayment 
} from '../integrations/asaas/client';

interface Payment {
  asaas_id: string;
  value: number;
  net_value?: number;
  status: string;
  due_date: string;
  billing_type: string;
  invoice_url?: string;
  description: string;
}

interface Subscription {
  asaas_id: string;
  value: number;
  next_due_date: string;
  status: string;
  billing_type: string;
  description: string;
  plan_id?: string;
}

const UserSubscriptionPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Estados
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('subscription');
  
  // Estado para modais e formulários
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState<boolean>(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>('PIX');
  const [updatingPayment, setUpdatingPayment] = useState<boolean>(false);
  
  const [showChangePlanModal, setShowChangePlanModal] = useState<boolean>(false);
  const [newPlanId, setNewPlanId] = useState<string>('');
  const [newPlanValue, setNewPlanValue] = useState<string>('');
  const [applyImmediately, setApplyImmediately] = useState<boolean>(false);
  const [changingPlan, setChangingPlan] = useState<boolean>(false);
  
  // Verificar autenticação
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?redirect=/my-subscription');
    }
  }, [user, authLoading, navigate]);
  
  // Carregar dados
  useEffect(() => {
    if (user && !loading) {
      loadSubscriptionData();
    }
  }, [user]);
  
  const loadSubscriptionData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Buscar dados da assinatura e pagamentos
      const response = await axios.get(`/api/payments-history?userId=${user?.id}`);
      
      if (response.data.success && response.data.data) {
        setPayments(response.data.data.payments || []);
        setSubscription(response.data.data.subscription);
      } else {
        setError('Não foi possível carregar os dados da assinatura');
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao buscar dados da assinatura');
    } finally {
      setLoading(false);
    }
  };
  
  // Cancelar assinatura
  const handleCancelSubscription = async () => {
    if (!subscription) return;
    
    setCancelling(true);
    setError(null);
    
    try {
      await cancelAsaasSubscription(subscription.asaas_id);
      
      // Atualizar dados locais
      setSubscription(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
      setShowCancelModal(false);
      
      // Mostrar mensagem de sucesso
      alert('Assinatura cancelada com sucesso!');
    } catch (err) {
      console.error('Erro ao cancelar assinatura:', err);
      setError('Não foi possível cancelar a assinatura');
    } finally {
      setCancelling(false);
    }
  };
  
  // Atualizar método de pagamento
  const handleUpdatePaymentMethod = async () => {
    if (!subscription) return;
    
    setUpdatingPayment(true);
    setError(null);
    
    try {
      await axios.post('/api/subscription-update-payment', {
        subscriptionId: subscription.asaas_id,
        userId: user?.id,
        billingType: newPaymentMethod
      });
      
      // Atualizar dados locais
      setSubscription(prev => prev ? { ...prev, billing_type: newPaymentMethod } : null);
      setShowPaymentMethodModal(false);
      
      // Recarregar dados
      loadSubscriptionData();
      
      // Mostrar mensagem de sucesso
      alert('Método de pagamento atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar método de pagamento:', err);
      setError('Não foi possível atualizar o método de pagamento');
    } finally {
      setUpdatingPayment(false);
    }
  };
  
  // Mudar de plano
  const handleChangePlan = async () => {
    if (!subscription || !newPlanId || !newPlanValue) return;
    
    setChangingPlan(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/subscription-change-plan', {
        subscriptionId: subscription.asaas_id,
        userId: user?.id,
        newPlanId,
        newValue: newPlanValue,
        applyImmediately
      });
      
      // Atualizar dados locais
      setSubscription(prev => prev ? { 
        ...prev, 
        value: parseFloat(newPlanValue),
        plan_id: newPlanId
      } : null);
      
      setShowChangePlanModal(false);
      
      // Se tiver um pagamento pro-rata, notificar o usuário
      if (response.data.proRataPayment) {
        alert(`Plano atualizado com sucesso! Foi gerado um pagamento adicional de R$ ${response.data.proRataPayment.value} referente à diferença pro-rata.`);
      } else {
        alert('Plano atualizado com sucesso!');
      }
      
      // Recarregar dados
      loadSubscriptionData();
    } catch (err) {
      console.error('Erro ao mudar de plano:', err);
      setError('Não foi possível alterar o plano');
    } finally {
      setChangingPlan(false);
    }
  };
  
  // Formatar status do pagamento
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'RECEIVED':
        return <Badge bg="success">Confirmado</Badge>;
      case 'PENDING':
        return <Badge bg="warning" text="dark">Pendente</Badge>;
      case 'OVERDUE':
        return <Badge bg="danger">Atrasado</Badge>;
      case 'REFUNDED':
        return <Badge bg="info">Reembolsado</Badge>;
      case 'CANCELLED':
        return <Badge bg="secondary">Cancelado</Badge>;
      default:
        return <Badge bg="light" text="dark">{status}</Badge>;
    }
  };
  
  // Formatar método de pagamento
  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'PIX':
        return 'PIX';
      case 'CREDIT_CARD':
        return 'Cartão de Crédito';
      case 'BOLETO':
        return 'Boleto';
      default:
        return method;
    }
  };
  
  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };
  
  // Se ainda está carregando ou não há usuário, mostrar loading
  if (authLoading || !user) {
    return (
      <Container className="my-4 text-center">
        <Spinner animation="border" />
        <p>Carregando...</p>
      </Container>
    );
  }
  
  return (
    <Container className="my-4">
      <h2 className="mb-4">Minha Assinatura</h2>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      {loading ? (
        <div className="text-center my-5">
          <Spinner animation="border" />
          <p className="mt-2">Carregando dados da assinatura...</p>
        </div>
      ) : (
        <>
          <Tabs 
            id="subscription-tabs" 
            activeKey={activeTab} 
            onSelect={(k) => setActiveTab(k || 'subscription')}
            className="mb-4"
          >
            <Tab eventKey="subscription" title="Assinatura">
              {subscription ? (
                <Card>
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Detalhes da Assinatura</h5>
                    {getPaymentStatusBadge(subscription.status)}
                  </Card.Header>
                  <Card.Body>
                    <Row>
                      <Col md={6}>
                        <p><strong>Plano:</strong> {subscription.description}</p>
                        <p><strong>Valor:</strong> R$ {subscription.value.toFixed(2)}</p>
                        <p><strong>Método de Pagamento:</strong> {formatPaymentMethod(subscription.billing_type)}</p>
                      </Col>
                      <Col md={6}>
                        <p><strong>Status:</strong> {subscription.status}</p>
                        <p><strong>Próximo Vencimento:</strong> {formatDate(subscription.next_due_date)}</p>
                      </Col>
                    </Row>
                    
                    {subscription.status === 'ACTIVE' && (
                      <div className="mt-3">
                        <Button 
                          variant="outline-primary" 
                          className="me-2"
                          onClick={() => setShowPaymentMethodModal(true)}
                        >
                          Alterar Forma de Pagamento
                        </Button>
                        <Button 
                          variant="outline-primary" 
                          className="me-2"
                          onClick={() => setShowChangePlanModal(true)}
                        >
                          Mudar de Plano
                        </Button>
                        <Button 
                          variant="outline-danger"
                          onClick={() => setShowCancelModal(true)}
                        >
                          Cancelar Assinatura
                        </Button>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ) : (
                <Alert variant="info">
                  Você ainda não tem uma assinatura ativa. <a href="/plans">Clique aqui</a> para conhecer nossos planos.
                </Alert>
              )}
            </Tab>
            
            <Tab eventKey="payments" title="Histórico de Pagamentos">
              <Card>
                <Card.Header>
                  <h5 className="mb-0">Meus Pagamentos</h5>
                </Card.Header>
                <Card.Body>
                  {payments.length > 0 ? (
                    <Table responsive striped>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Descrição</th>
                          <th>Valor</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(payment => (
                          <tr key={payment.asaas_id}>
                            <td>{formatDate(payment.due_date)}</td>
                            <td>{payment.description}</td>
                            <td>R$ {payment.value.toFixed(2)}</td>
                            <td>{getPaymentStatusBadge(payment.status)}</td>
                            <td>
                              {payment.invoice_url && (
                                <Button 
                                  variant="link" 
                                  size="sm"
                                  href={payment.invoice_url}
                                  target="_blank"
                                >
                                  Ver Fatura
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <Alert variant="info">
                      Nenhum pagamento encontrado.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
          
          {/* Modal para cancelar assinatura */}
          <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Cancelar Assinatura</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>Tem certeza que deseja cancelar sua assinatura?</p>
              <p>Ao cancelar, você perderá acesso aos recursos premium ao final do período já pago.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
                Voltar
              </Button>
              <Button 
                variant="danger" 
                onClick={handleCancelSubscription}
                disabled={cancelling}
              >
                {cancelling ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Cancelando...
                  </>
                ) : 'Confirmar Cancelamento'}
              </Button>
            </Modal.Footer>
          </Modal>
          
          {/* Modal para alterar método de pagamento */}
          <Modal show={showPaymentMethodModal} onHide={() => setShowPaymentMethodModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Alterar Forma de Pagamento</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Novo Método de Pagamento</Form.Label>
                  <Form.Control
                    as="select"
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                  >
                    <option value="PIX">PIX</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="BOLETO">Boleto</option>
                  </Form.Control>
                </Form.Group>
                
                {newPaymentMethod === 'CREDIT_CARD' && (
                  <Alert variant="info">
                    Para alterar para cartão de crédito, você será redirecionado para uma página de pagamento segura.
                  </Alert>
                )}
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowPaymentMethodModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                onClick={handleUpdatePaymentMethod}
                disabled={updatingPayment}
              >
                {updatingPayment ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Atualizando...
                  </>
                ) : 'Confirmar Alteração'}
              </Button>
            </Modal.Footer>
          </Modal>
          
          {/* Modal para mudar de plano */}
          <Modal show={showChangePlanModal} onHide={() => setShowChangePlanModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Mudar de Plano</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Novo Plano</Form.Label>
                  <Form.Control
                    as="select"
                    value={newPlanId}
                    onChange={(e) => {
                      setNewPlanId(e.target.value);
                      // Aqui poderia buscar o valor do plano automaticamente
                      // Por simplicidade, vamos deixar que o usuário informe o valor
                    }}
                  >
                    <option value="">Selecione um plano</option>
                    <option value="basic">Básico (R$ 29,90)</option>
                    <option value="pro">Profissional (R$ 49,90)</option>
                    <option value="premium">Premium (R$ 99,90)</option>
                  </Form.Control>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Valor (R$)</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPlanValue}
                    onChange={(e) => setNewPlanValue(e.target.value)}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Aplicar alteração imediatamente (cobrança proporcional)"
                    checked={applyImmediately}
                    onChange={(e) => setApplyImmediately(e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Se marcado, será cobrada a diferença proporcional ao tempo restante do ciclo atual.
                  </Form.Text>
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowChangePlanModal(false)}>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                onClick={handleChangePlan}
                disabled={changingPlan || !newPlanId || !newPlanValue}
              >
                {changingPlan ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Atualizando...
                  </>
                ) : 'Confirmar Mudança'}
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
    </Container>
  );
};

export default UserSubscriptionPage; 