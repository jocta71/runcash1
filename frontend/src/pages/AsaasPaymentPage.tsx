import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createAsaasSubscription, findAsaasPayment, findAsaasCustomer } from '../integrations/asaas/client';
import PaymentPixModal from '../components/PaymentPixModal';
import { PaymentStatusChecker } from '../components/PaymentStatusChecker';
import { Alert, Button, Card, Container, Row, Col, Spinner, Form } from 'react-bootstrap';
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
  const customerId = queryParams.get('customerId') || user?.asaasCustomerId || null;
  const returnUrl = queryParams.get('returnUrl') || '/billing';
  const paymentMethod = queryParams.get('paymentMethod') || 'PIX';
  
  // Estados
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [showPixModal, setShowPixModal] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isVerifyingStatus, setIsVerifyingStatus] = useState<boolean>(false);
  const [cpf, setCpf] = useState<string>('');
  const [showCpfForm, setShowCpfForm] = useState<boolean>(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [loadingCpf, setLoadingCpf] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasCpf, setHasCpf] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Efeito para iniciar o processo de pagamento quando a página carrega
  useEffect(() => {
    if (planId && user && customerId) {
      // Verificar se temos customerId, seja da URL ou do perfil do usuário
      const effectiveCustomerId = customerId || user.asaasCustomerId;
      
      if (effectiveCustomerId) {
        // Buscar dados do cliente no Asaas para verificar se tem CPF
        loadCustomerData(effectiveCustomerId);
      } else {
        setError('ID do cliente Asaas não encontrado. Por favor, entre em contato com o suporte.');
      }
    }
  }, [planId, customerId, user]);

  // Função para carregar dados do cliente
  const loadCustomerData = async (customerId: string) => {
    try {
      setIsLoading(true);
      // Verificar se o findAsaasCustomer está disponível
      if (typeof findAsaasCustomer === 'function') {
        const customerResponse = await findAsaasCustomer({ customerId });
        const customerInfo = customerResponse.customer;
        setCustomerData(customerInfo);
        
        // Se o cliente não tem CPF, mostrar formulário
        if (!customerInfo.cpfCnpj) {
          setShowCpfForm(true);
        } else {
          // Se já tem CPF, criar a assinatura
          await createPayment(customerId, customerInfo.cpfCnpj);
        }
      } else {
        // Se a função não estiver disponível, tentar criar sem o CPF
        await createPayment(customerId);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
      setShowCpfForm(true); // Mostrar formulário em caso de erro
    } finally {
      setIsLoading(false);
    }
  };

  // Função para submeter o formulário de CPF
  const handleCpfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingCpf(true);
    setErrorMessage('');
    
    try {
      // Garantir que o CPF esteja limpo
      const cleanedCpf = cpf.replace(/[^\d]/g, '');
      
      if (cleanedCpf.length !== 11) {
        throw new Error('O CPF deve conter 11 dígitos');
      }
      
      console.log(`Tentando atualizar cliente ${customerId} com CPF: ${cleanedCpf}`);
      
      // Atualizar o cliente com o CPF
      const response = await fetch('/api/update-customer-cpf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          cpfCnpj: cleanedCpf
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar CPF');
      }
      
      console.log('CPF atualizado com sucesso:', data);
      
      // Verificar se o cliente foi atualizado com sucesso
      if (data.success) {
        setHasCpf(true);
        setShowCpfForm(false);
        setSuccessMessage('CPF registrado com sucesso! Continuando com o pagamento...');
        
        // Tentar criar o pagamento novamente
        setTimeout(() => {
          createPayment();
        }, 1000);
      } else {
        throw new Error(data.error || 'Erro ao atualizar CPF no Asaas');
      }
    } catch (error) {
      console.error('Erro ao enviar CPF:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao registrar CPF. Tente novamente.');
    } finally {
      setLoadingCpf(false);
    }
  };

  // Função para criar o pagamento/assinatura
  const createPayment = async (effectiveCustomerId: string = customerId || '', cpfCnpj?: string) => {
    if (!planId || !effectiveCustomerId || !user) {
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
        effectiveCustomerId, 
        paymentMethod,
        null, // creditCard
        cpfCnpj ? { cpfCnpj } : undefined // Incluir CPF se disponível
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
      if (error instanceof Error && 
          (error.message.includes('CPF ou CNPJ do cliente') || 
           (error.message.includes('Erro na API do Asaas') && 
            typeof (error as any).requiresCpfCnpj === 'boolean' && 
            (error as any).requiresCpfCnpj))) {
        console.log('Detectado erro relacionado a CPF/CNPJ, exibindo formulário...');
        setShowCpfForm(true); // Mostrar formulário de CPF se o erro for relacionado
        setError('É necessário informar seu CPF para continuar com o pagamento. Por favor, preencha o formulário abaixo.');
      } else {
        setError(error instanceof Error ? error.message : 'Ocorreu um erro ao processar o pagamento.');
      }
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
              
              {/* Formulário para inserir CPF quando necessário */}
              {showCpfForm && (
                <div className="mb-4">
                  <Alert variant="info">
                    É necessário informar seu CPF para continuar com o pagamento.
                  </Alert>
                  <Form onSubmit={handleCpfSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>CPF</Form.Label>
                      <Form.Control 
                        type="text" 
                        placeholder="Digite seu CPF (apenas números)" 
                        value={cpf}
                        onChange={(e) => setCpf(e.target.value)}
                        maxLength={14}
                        required
                      />
                      <Form.Text className="text-muted">
                        Seu CPF é necessário para processamento do pagamento.
                      </Form.Text>
                    </Form.Group>
                    <div className="d-grid">
                      <Button type="submit" variant="primary">
                        {loadingCpf ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Processando...
                          </>
                        ) : 'Continuar'}
                      </Button>
                    </div>
                  </Form>
                </div>
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
          />
        </div>
      )}
    </Container>
  );
};

export default AsaasPaymentPage; 