import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { createAsaasCustomer, createAsaasSubscription, findAsaasPayment, cancelAsaasSubscription } from '../integrations/asaas/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'name') {
      setName(value);
    } else if (name === 'email') {
      setEmail(value);
    } else if (name === 'cpfCnpj') {
      setCpf(value.replace(/\D/g, ''));
    } else if (name === 'phone') {
      setPhone(value.replace(/\D/g, ''));
    } else if (name === 'plan') {
      setPlanId(value);
    } else if (name === 'paymentMethod') {
      setPaymentMethod(value);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSubscriptionResult(null);
    
    try {
      // Primeiro, criar o cliente no Asaas
      const customerResponse = await axios.post('/api/asaas-create-customer', {
        name,
        email,
        cpfCnpj: cpf.replace(/\D/g, ''),
        phone: phone.replace(/\D/g, ''),
        userId: user?.id
      });
      
      if (customerResponse.data.id) {
        const customerId = customerResponse.data.id;
        
        // Depois, criar a assinatura
        const subscriptionResponse = await axios.post('/api/asaas-create-subscription', {
          customerId,
          planId: planId,
          value: planId === 'basic' ? 29.90 : planId === 'pro' ? 49.90 : 99.90,
          billingType: paymentMethod,
          userId: user?.id
        });
        
        if (subscriptionResponse.data.success) {
          setSubscriptionResult(subscriptionResponse.data);
          setCustomerId(customerId);
          setPaymentId(subscriptionResponse.data.paymentId);
          
          // Se houver URL de pagamento, redirecionar
          if (subscriptionResponse.data.paymentUrl) {
            window.open(subscriptionResponse.data.paymentUrl, '_blank');
          }
        } else {
          setError('Erro ao criar assinatura: ' + JSON.stringify(subscriptionResponse.data.error));
        }
      } else {
        setError('Erro ao criar cliente: ' + JSON.stringify(customerResponse.data.error));
      }
    } catch (err: any) {
      console.error('Erro ao processar pagamento:', err);
      setError('Erro ao processar pagamento: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Container className="py-5">
      <h1 className="mb-4">Teste de Integração Asaas</h1>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome completo</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={name}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>E-mail</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={email}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>CPF/CNPJ</Form.Label>
                  <Form.Control
                    type="text"
                    name="cpfCnpj"
                    value={cpf}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Telefone</Form.Label>
                  <Form.Control
                    type="text"
                    name="phone"
                    value={phone}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Plano</Form.Label>
                  <Form.Select
                    name="plan"
                    value={planId}
                    onChange={handleChange}
                    required
                  >
                    <option value="basic">Básico - R$ 29,90/mês</option>
                    <option value="pro">Profissional - R$ 49,90/mês</option>
                    <option value="premium">Premium - R$ 99,90/mês</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Método de Pagamento</Form.Label>
                  <Form.Select
                    name="paymentMethod"
                    value={paymentMethod}
                    onChange={handleChange}
                    required
                  >
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Button 
              variant="primary" 
              type="submit" 
              disabled={isLoading}
              className="w-100 mt-3"
            >
              {isLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Processando...
                </>
              ) : 'Assinar Agora'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AsaasTestPage; 