import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Badge, ListGroup } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SubscriptionTestPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Estados para o formulário de cadastro
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  
  // Estados para o plano
  const [selectedPlan, setSelectedPlan] = useState<string>('basic');
  
  // Estados para os dados das roletas
  const [rouletteData, setRouletteData] = useState<any[]>([]);
  const [isFetchingRoulettes, setIsFetchingRoulettes] = useState<boolean>(false);
  
  // Estados para status da assinatura
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [customerId, setCustomerId] = useState<string>('');
  const [subscriptionId, setSubscriptionId] = useState<string>('');
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  
  // Estados para resultados e erros
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  
  // Carregar dados do usuário se já estiver logado
  useEffect(() => {
    if (user) {
      setName(user.username || '');
      setEmail(user.email || '');
      
      // Verificar status da assinatura
      checkSubscriptionStatus();
    }
  }, [user]);
  
  // Função para adicionar mensagens ao log
  const addLog = (message: string) => {
    setLogMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };
  
  // Limpar log
  const clearLog = () => {
    setLogMessages([]);
  };
  
  // Registrar um novo usuário
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      addLog('Iniciando registro de usuário...');
      
      // Simular registro (na implementação real, chamar API de registro)
      // No ambiente de produção, use a API real de registro
      const response = await axios.post('/api/auth/register', {
        username: name,
        email,
        password,
        cpf: cpf.replace(/\D/g, ''),
        phone: phone.replace(/\D/g, '')
      });
      
      if (response.data && response.data.success) {
        setSuccess('Usuário registrado com sucesso!');
        addLog('Usuário registrado com sucesso!');
        
        // Simular login automaticamente após registro
        await handleLogin();
      }
    } catch (err: any) {
      console.error('Erro ao registrar:', err);
      setError(err.response?.data?.message || 'Erro ao registrar usuário');
      addLog(`ERRO: ${err.response?.data?.message || 'Erro ao registrar usuário'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Login com o usuário registrado
  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      addLog('Fazendo login...');
      
      // Na implementação real, chamar API de login
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });
      
      if (response.data && response.data.token) {
        // Armazenar token e recarregar a página para atualizar o estado de autenticação
        localStorage.setItem('auth_token', response.data.token);
        addLog('Login realizado com sucesso!');
        window.location.reload();
      }
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      setError(err.response?.data?.message || 'Erro ao fazer login');
      addLog(`ERRO: ${err.response?.data?.message || 'Erro ao fazer login'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Criar assinatura
  const handleCreateSubscription = async () => {
    if (!user) {
      setError('Você precisa estar logado para criar uma assinatura');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      addLog(`Criando assinatura para o plano: ${selectedPlan}...`);
      
      // Criar cliente no Asaas se ainda não existir
      if (!user.asaasCustomerId) {
        addLog('Criando cliente no Asaas...');
        
        // Na implementação real, chamar API para criar cliente
        const customerResponse = await axios.post('/api/asaas-create-customer', {
          name: user.username,
          email: user.email,
          cpfCnpj: cpf.replace(/\D/g, '')
        });
        
        if (customerResponse.data && customerResponse.data.id) {
          setCustomerId(customerResponse.data.id);
          addLog(`Cliente criado no Asaas com ID: ${customerResponse.data.id}`);
        }
      } else {
        setCustomerId(user.asaasCustomerId);
      }
      
      // Criar assinatura
      addLog('Criando assinatura...');
      const subscriptionResponse = await axios.post('/api/asaas-create-subscription', {
        customerId: customerId || user.asaasCustomerId,
        planId: selectedPlan
      });
      
      if (subscriptionResponse.data) {
        setSuccess('Assinatura criada! Redirecionando para pagamento...');
        setSubscriptionId(subscriptionResponse.data.id);
        setPaymentUrl(subscriptionResponse.data.paymentLink);
        addLog(`Assinatura criada com ID: ${subscriptionResponse.data.id}`);
        addLog(`Link de pagamento gerado: ${subscriptionResponse.data.paymentLink}`);
      }
    } catch (err: any) {
      console.error('Erro ao criar assinatura:', err);
      setError(err.response?.data?.message || 'Erro ao criar assinatura');
      addLog(`ERRO: ${err.response?.data?.message || 'Erro ao criar assinatura'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Verificar status da assinatura
  const checkSubscriptionStatus = async () => {
    if (!user) return;
    
    setIsLoadingStatus(true);
    
    try {
      addLog('Verificando status da assinatura...');
      
      // Na implementação real, chamar API para verificar status
      const response = await axios.get('/api/subscription/status');
      
      if (response.data) {
        setSubscriptionStatus(response.data.subscription?.status || 'inactive');
        setSubscriptionId(response.data.subscription?.id || '');
        
        addLog(`Status da assinatura: ${response.data.subscription?.status || 'inactive'}`);
        
        if (response.data.hasSubscription) {
          addLog('Usuário possui assinatura ativa!');
        } else {
          addLog('Usuário não possui assinatura ativa.');
        }
      }
    } catch (err: any) {
      console.error('Erro ao verificar status da assinatura:', err);
      addLog(`ERRO ao verificar assinatura: ${err.message}`);
    } finally {
      setIsLoadingStatus(false);
    }
  };
  
  // Buscar dados das roletas
  const fetchRouletteData = async () => {
    setIsFetchingRoulettes(true);
    setError(null);
    
    try {
      addLog('Buscando dados das roletas...');
      
      // Na implementação real, chamar API para buscar roletas
      const response = await axios.get('/api/roulettes');
      
      if (response.data) {
        setRouletteData(response.data);
        addLog(`Recebidos ${response.data.length} registros de roletas`);
      }
    } catch (err: any) {
      console.error('Erro ao buscar roletas:', err);
      setError(err.response?.data?.message || 'Erro ao buscar dados das roletas');
      addLog(`ERRO: ${err.response?.data?.message || 'Erro ao buscar dados das roletas'}`);
    } finally {
      setIsFetchingRoulettes(false);
    }
  };
  
  // Simular aprovação de pagamento
  const simulatePaymentApproval = async () => {
    if (!subscriptionId) {
      setError('ID da assinatura é necessário');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      addLog('Simulando aprovação de pagamento...');
      
      // Na implementação real, chamar API para simular/aprovar pagamento
      const response = await axios.post('/api/simulate-payment-approval', {
        subscriptionId
      });
      
      if (response.data && response.data.success) {
        setSuccess('Pagamento aprovado com sucesso!');
        addLog('Pagamento aprovado com sucesso!');
        
        // Atualizar status da assinatura
        await checkSubscriptionStatus();
      }
    } catch (err: any) {
      console.error('Erro ao simular aprovação:', err);
      setError(err.response?.data?.message || 'Erro ao simular aprovação de pagamento');
      addLog(`ERRO: ${err.response?.data?.message || 'Erro ao simular aprovação de pagamento'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Container className="my-4">
      <h2 className="mb-4">Teste de Fluxo de Assinatura Completo</h2>
      
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
      
      <Row>
        <Col md={7}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                {user ? 'Informações do Usuário' : 'Cadastro de Usuário'}
              </h5>
            </Card.Header>
            <Card.Body>
              {!user ? (
                <Form onSubmit={handleRegister}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nome</Form.Label>
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
                    <Form.Label>Senha</Form.Label>
                    <Form.Control 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)}
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
                    ) : 'Registrar e Entrar'}
                  </Button>
                </Form>
              ) : (
                <div>
                  <p><strong>Usuário:</strong> {user.username}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p>
                    <strong>Status da Assinatura:</strong>{' '}
                    {isLoadingStatus ? <Spinner size="sm" animation="border" /> : (
                      <Badge bg={subscriptionStatus === 'active' ? 'success' : 'warning'}>
                        {subscriptionStatus === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    )}
                  </p>
                  
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    onClick={checkSubscriptionStatus}
                    disabled={isLoadingStatus}
                  >
                    {isLoadingStatus ? 'Verificando...' : 'Verificar Status da Assinatura'}
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
          
          {user && (
            <>
              <Card className="mb-4">
                <Card.Header>
                  <h5 className="mb-0">Criar Assinatura</h5>
                </Card.Header>
                <Card.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>Plano</Form.Label>
                    <Form.Select
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                    >
                      <option value="basic">Básico (R$ 29,90/mês)</option>
                      <option value="pro">Pro (R$ 49,90/mês)</option>
                      <option value="premium">Premium (R$ 99,90/mês)</option>
                    </Form.Select>
                  </Form.Group>
                  
                  <Button 
                    onClick={handleCreateSubscription} 
                    disabled={isLoading}
                    className="mb-3"
                  >
                    {isLoading ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Processando...
                      </>
                    ) : 'Criar Assinatura'}
                  </Button>
                  
                  {paymentUrl && (
                    <div className="mt-3">
                      <Alert variant="info">
                        Link de pagamento gerado! 
                      </Alert>
                      <div className="d-grid gap-2">
                        <Button 
                          variant="success" 
                          href={paymentUrl} 
                          target="_blank"
                        >
                          Acessar Link de Pagamento
                        </Button>
                        <Button 
                          variant="outline-primary" 
                          onClick={simulatePaymentApproval}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Processando...' : 'Simular Aprovação de Pagamento'}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card.Body>
              </Card>
              
              <Card className="mb-4">
                <Card.Header>
                  <h5 className="mb-0">Acesso a Dados Protegidos</h5>
                </Card.Header>
                <Card.Body>
                  <Button 
                    onClick={fetchRouletteData} 
                    disabled={isFetchingRoulettes}
                    className="mb-3"
                  >
                    {isFetchingRoulettes ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Buscando...
                      </>
                    ) : 'Buscar Dados de Roletas'}
                  </Button>
                  
                  {rouletteData.length > 0 ? (
                    <div className="mt-3">
                      <p><strong>Dados recebidos:</strong> {rouletteData.length} roletas</p>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <ListGroup>
                          {rouletteData.slice(0, 10).map((roulette, index) => (
                            <ListGroup.Item key={index}>
                              {roulette.nome || roulette.name}
                            </ListGroup.Item>
                          ))}
                          {rouletteData.length > 10 && (
                            <ListGroup.Item variant="light">
                              + {rouletteData.length - 10} outras roletas
                            </ListGroup.Item>
                          )}
                        </ListGroup>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted">
                      Nenhum dado de roleta disponível. Clique no botão para buscar dados.
                    </p>
                  )}
                </Card.Body>
              </Card>
            </>
          )}
        </Col>
        
        <Col md={5}>
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Log de Eventos</h5>
              <Button variant="link" size="sm" onClick={clearLog}>Limpar</Button>
            </Card.Header>
            <Card.Body className="p-0">
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <ListGroup variant="flush">
                  {logMessages.length > 0 ? (
                    logMessages.map((log, index) => (
                      <ListGroup.Item key={index} className="small py-2">
                        {log}
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item className="text-center text-muted py-3">
                      Nenhum evento registrado.
                    </ListGroup.Item>
                  )}
                </ListGroup>
              </div>
            </Card.Body>
          </Card>
          
          <Card>
            <Card.Header>
              <h5 className="mb-0">Ajuda</h5>
            </Card.Header>
            <Card.Body>
              <p className="small">
                <strong>Fluxo de teste:</strong>
              </p>
              <ol className="small">
                <li>Registre-se como um novo usuário ou faça login</li>
                <li>Crie uma assinatura selecionando um plano</li>
                <li>Clique no link de pagamento ou use o botão "Simular Aprovação"</li>
                <li>Verifique o status da assinatura após o pagamento</li>
                <li>Teste o acesso aos dados protegidos das roletas</li>
              </ol>
              <p className="small text-danger">
                <strong>Nota:</strong> Esta é uma página de teste apenas para diagnóstico.
                Em ambiente de produção, alguns passos podem ser diferentes.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default SubscriptionTestPage; 