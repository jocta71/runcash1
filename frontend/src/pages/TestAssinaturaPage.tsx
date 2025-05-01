import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { createAsaasCustomer, createAsaasSubscription } from '@/integrations/asaas/client';
import axios from 'axios';

// API client
const api = {
  post: async (url: string, data: any) => {
    return axios.post(url, data);
  },
  get: async (url: string) => {
    return axios.get(url);
  }
};

const TestAssinaturaPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentPlan, availablePlans, loading: subscriptionLoading, loadUserSubscription } = useSubscription();
  const navigate = useNavigate();
  
  // Estados do usuário
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  
  // Estados do processo
  const [step, setStep] = useState(user ? 'subscription' : 'register');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'premium'>('pro');
  
  // Estado de assinatura
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  
  // Estado da verificação de assinatura
  const [accessStatus, setAccessStatus] = useState<{
    canAccess: boolean;
    message: string;
    data?: any;
  } | null>(null);
  
  // Estado para informações detalhadas da assinatura
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [loadingSubscriptionDetails, setLoadingSubscriptionDetails] = useState(false);
  
  // Estado para eventos de webhook recentes
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  
  // QR Code PIX
  const [pixQrCode, setPixQrCode] = useState<{
    image: string;
    text: string;
    expirationDate?: string;
  } | null>(null);
  
  // Estado dos dados de roleta
  const [rouletteData, setRouletteData] = useState<any[] | null>(null);
  const [loadingRoulettes, setLoadingRoulettes] = useState(false);

  // Efeito para verificar autenticação
  useEffect(() => {
    if (user) {
      // Se o usuário já está com o customerId do Asaas mas não tem CPF/CNPJ preenchido,
      // vamos para a etapa de cliente para garantir que o CPF seja informado
      if (user.asaasCustomerId && !cpfCnpj) {
        setStep('customer');
        setCustomerId(user.asaasCustomerId);
        console.log('Cliente já existe no Asaas, mas precisamos do CPF/CNPJ para criar a assinatura');
      } 
      // Se já tem o customerId e o CPF/CNPJ já está preenchido, vamos para assinatura
      else if (user.asaasCustomerId && cpfCnpj) {
        setStep('subscription');
        setCustomerId(user.asaasCustomerId);
        console.log('Cliente já existe e CPF/CNPJ já preenchido, indo para etapa de escolha de plano');
      }
      // Se não tem o customerId, vamos para a etapa de cliente
      else {
        setStep('customer');
        console.log('Usuário logado, mas precisamos criar o cliente no Asaas');
      }
    }
  }, [user, cpfCnpj]);

  // Método de login
  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      
      if (response.data && response.data.success) {
        // Atualizará automaticamente o contexto de autenticação
        return { success: true };
      }
      
      return { 
        success: false, 
        message: response.data?.message || 'Erro de autenticação' 
      };
    } catch (error: any) {
      console.error('Erro no login:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Erro ao efetuar login' 
      };
    }
  };

  // Função para cadastrar o usuário
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);
    
    try {
      // Validação básica
      if (!username || !email || !password || !cpfCnpj) {
        throw new Error('Preencha todos os campos obrigatórios');
      }
      
      // Registrar o usuário
      const registerResult = await api.post('/auth/register', {
        username,
        email,
        password,
        cpfCnpj: cpfCnpj.replace(/[^\d]/g, '') // Remover caracteres não numéricos
      });
      
      if (!registerResult.data.success) {
        throw new Error(registerResult.data.message || 'Erro ao cadastrar usuário');
      }
      
      // Efetuar login
      const loginResult = await login(email, password);
      if (!loginResult.success) {
        throw new Error(loginResult.message || 'Erro ao fazer login');
      }
      
      setSuccess('Usuário cadastrado e autenticado com sucesso!');
      setStep('customer');
    } catch (err: any) {
      console.error('Erro no registro:', err);
      setError(err.message || 'Ocorreu um erro ao cadastrar usuário');
    } finally {
      setProcessing(false);
    }
  };

  // Função para criar cliente no Asaas
  const handleCreateCustomer = async () => {
    if (!user) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      // Criar cliente no Asaas
      const customerResult = await createAsaasCustomer({
        name: username || user.username,
        email: email || user.email,
        cpfCnpj: cpfCnpj.replace(/[^\d]/g, ''),
        mobilePhone: phone,
        userId: user.id
      });
      
      setCustomerId(customerResult);
      setSuccess('Cliente criado no Asaas com sucesso!');
      setStep('subscription');
    } catch (err: any) {
      console.error('Erro ao criar cliente:', err);
      setError(err.message || 'Ocorreu um erro ao criar cliente no Asaas');
    } finally {
      setProcessing(false);
    }
  };

  // Função para criar assinatura
  const handleCreateSubscription = async () => {
    if (!user || !customerId) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      // Validação do CPF/CNPJ
      if (!cpfCnpj) {
        throw new Error('CPF/CNPJ é obrigatório para criar uma assinatura');
      }
      
      // Criar assinatura no Asaas
      const subscriptionResult = await createAsaasSubscription(
        selectedPlan,
        user.id,
        customerId,
        'PIX',  // Método de pagamento
        undefined,  // Dados de cartão de crédito (não utilizado aqui)
        undefined,  // Dados do titular do cartão (não utilizado aqui)
        cpfCnpj.replace(/[^\d]/g, '')  // CPF/CNPJ limpo, sem caracteres especiais
      );
      
      setSubscriptionId(subscriptionResult.subscriptionId);
      setPaymentId(subscriptionResult.paymentId);
      setSubscriptionStatus(subscriptionResult.status);
      
      // Buscar QR Code PIX
      if (subscriptionResult.paymentId) {
        await loadPixQrCode(subscriptionResult.paymentId);
      }
      
      setSuccess('Assinatura criada com sucesso! Use o QR Code PIX para pagar.');
      setStep('payment');
      
      // Iniciar verificação periódica do status
      startPaymentStatusCheck(subscriptionResult.paymentId);
    } catch (err: any) {
      console.error('Erro ao criar assinatura:', err);
      setError(err.message || 'Ocorreu um erro ao criar assinatura');
    } finally {
      setProcessing(false);
    }
  };

  // Função para carregar QR Code PIX
  const loadPixQrCode = async (paymentId: string) => {
    try {
      const response = await api.get(`/api/asaas-pix-qrcode?paymentId=${paymentId}`);
      
      if (response.data && response.data.success) {
        setPixQrCode({
          image: response.data.qrCode.encodedImage,
          text: response.data.qrCode.payload,
          expirationDate: response.data.qrCode.expirationDate
        });
      } else {
        console.error('Resposta inválida ao buscar QR Code:', response.data);
      }
    } catch (err) {
      console.error('Erro ao buscar QR Code PIX:', err);
    }
  };

  // Função para iniciar verificação periódica do pagamento
  const startPaymentStatusCheck = (paymentId: string) => {
    const interval = setInterval(async () => {
      try {
        // Verificar status do pagamento
        const response = await api.get(`/api/asaas-find-payment?paymentId=${paymentId}`);
        
        if (response.data && response.data.payment) {
          const status = response.data.payment.status;
          setSubscriptionStatus(status);
          
          // Se o pagamento foi confirmado
          if (['RECEIVED', 'CONFIRMED', 'AVAILABLE'].includes(status)) {
            clearInterval(interval);
            setSuccess('Pagamento confirmado! Sua assinatura está ativa.');
            setStep('verification');
            
            // Atualizar informações de assinatura no contexto
            if (loadUserSubscription) {
              await loadUserSubscription(true);
            }
          }
          
          // Se o pagamento foi cancelado ou expirou
          if (['OVERDUE', 'CANCELED', 'REFUNDED'].includes(status)) {
            clearInterval(interval);
            setError(`Pagamento ${
              status === 'OVERDUE' ? 'expirado' : 
              status === 'CANCELED' ? 'cancelado' : 
              'estornado'
            }. Por favor, tente novamente.`);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar status do pagamento:', err);
      }
    }, 5000); // Verificar a cada 5 segundos
    
    // Limpar intervalo após 10 minutos (tempo de expiração do PIX)
    setTimeout(() => {
      clearInterval(interval);
    }, 10 * 60 * 1000);
    
    return interval;
  };

  // Função para testar acesso às roletas
  const testRouletteAccess = async () => {
    setError(null);
    setLoadingRoulettes(true);
    
    try {
      // Tentar acessar a API de roletas
      const response = await api.get('/api/roulettes');
      
      setRouletteData(response.data);
      setAccessStatus({
        canAccess: true,
        message: 'Acesso confirmado aos dados de roletas!',
        data: response.data
      });
    } catch (err: any) {
      console.error('Erro ao acessar dados de roletas:', err);
      setAccessStatus({
        canAccess: false,
        message: err.response?.data?.message || 'Não foi possível acessar os dados de roletas'
      });
    } finally {
      setLoadingRoulettes(false);
    }
  };

  // Função para buscar detalhes completos da assinatura
  const fetchSubscriptionDetails = async () => {
    setLoadingSubscriptionDetails(true);
    setError(null);
    
    try {
      // Buscar detalhes da assinatura atual do usuário
      const response = await api.get('/api/subscription/details');
      
      if (response.data && response.data.success) {
        setSubscriptionDetails(response.data.subscription);
        setSuccess('Detalhes da assinatura carregados com sucesso');
        
        // Tentar carregar logs de webhook também
        await fetchWebhookEvents(response.data.subscription.id);
      } else {
        console.error('Resposta inválida ao buscar detalhes da assinatura:', response.data);
        setError('Não foi possível obter detalhes completos da assinatura');
      }
    } catch (err: any) {
      console.error('Erro ao buscar detalhes da assinatura:', err);
      // Interpretar códigos de erro comuns do Asaas
      if (err.response?.status === 400) {
        setError('Solicitação inválida ao buscar assinatura (Erro 400). Verifique os dados fornecidos.');
      } else if (err.response?.status === 403) {
        setError('Acesso não autorizado (Erro 403). Verifique suas permissões.');
      } else if (err.response?.status === 404) {
        setError('Assinatura não encontrada (Erro 404). Verifique se o ID da assinatura está correto.');
      } else if (err.response?.status === 500) {
        setError('Erro interno do servidor Asaas (Erro 500). Tente novamente mais tarde.');
      } else {
        setError(err.response?.data?.message || 'Erro ao carregar detalhes da assinatura');
      }
    } finally {
      setLoadingSubscriptionDetails(false);
    }
  };
  
  // Função para buscar eventos de webhook recentes
  const fetchWebhookEvents = async (subscriptionId: string) => {
    if (!subscriptionId) return;
    
    setLoadingWebhooks(true);
    
    try {
      // Buscar eventos de webhook relacionados à assinatura
      const response = await api.get(`/api/webhook-logs?subscriptionId=${subscriptionId}`);
      
      if (response.data && response.data.success) {
        setWebhookEvents(response.data.events || []);
      } else {
        console.error('Resposta inválida ao buscar eventos de webhook:', response.data);
      }
    } catch (err) {
      console.error('Erro ao buscar eventos de webhook:', err);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  // Formatador de CPF/CNPJ
  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 11) {
      // CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0000-00
      return numbers
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
  };

  // Formatador de telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})(\d+?)$/, '$1');
  };

  // Decodificar mensagem de erro com base no código
  const decodeAsaasError = (code: string): string => {
    switch (code) {
      case 'invalid_billingType':
        return 'Tipo de cobrança inválido. Verifique se todos os dados comerciais estão preenchidos.';
      case 'WALLET_UNABLE_TO_RECEIVE':
        return 'Conta não habilitada para receber pagamentos. Verifique sua configuração no Asaas.';
      case 'VALUE_DIVERGENCE':
        return 'Divergência de valores no split de pagamento.';
      case 'SUBSCRIPTION_INACTIVE':
        return 'Assinatura inativa. Verifique o status do pagamento.';
      case 'NO_ACTIVE_SUBSCRIPTION': 
        return 'Não há assinatura ativa. Confirme o pagamento pendente.';
      case 'SUBSCRIPTION_REQUIRED':
        return 'É necessário ter uma assinatura para acessar este recurso.';
      default:
        return `Erro: ${code}`;
    }
  };

  // Renderizar formulário de cadastro
  const renderRegisterForm = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Cadastro de Usuário</CardTitle>
        <CardDescription>
          Crie sua conta para testar a assinatura
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Nome de Usuário</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
            <Input
              id="cpfCnpj"
              type="text"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
              required
              maxLength={18}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              maxLength={15}
            />
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Sucesso</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          <Button type="submit" className="w-full" disabled={processing}>
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : "Cadastrar e Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  // Renderizar criação de cliente
  const renderCustomerCreation = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{customerId ? 'Informações Adicionais' : 'Criar Cliente no Asaas'}</CardTitle>
        <CardDescription>
          {customerId 
            ? 'Precisamos do seu CPF/CNPJ para finalizar a assinatura'
            : 'Crie seu cadastro no Asaas para processar pagamentos'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Nome de Usuário</Label>
            <Input
              id="username"
              type="text"
              value={username || (user?.username || '')}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={!!customerId} // Desabilitar se o cliente já existir
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email || (user?.email || '')}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!!customerId} // Desabilitar se o cliente já existir
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cpfCnpj">CPF/CNPJ <span className="text-red-500">*</span></Label>
            <Input
              id="cpfCnpj"
              type="text"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
              required
              maxLength={18}
            />
            {customerId && (
              <p className="text-sm text-amber-600">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                O CPF/CNPJ é obrigatório para processar a assinatura
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              maxLength={15}
              disabled={!!customerId} // Desabilitar se o cliente já existir
            />
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Sucesso</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            className="w-full" 
            disabled={processing || (customerId && !cpfCnpj)} 
            onClick={customerId ? () => setStep('subscription') : handleCreateCustomer}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : customerId ? "Continuar para Escolha do Plano" : "Criar Cliente no Asaas"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Renderizar escolha de assinatura
  const renderSubscriptionSelection = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Escolha seu Plano</CardTitle>
        <CardDescription>
          Selecione um plano de assinatura para acessar os recursos premium
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Tabs value={selectedPlan} onValueChange={(value: any) => setSelectedPlan(value)} className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="pro">Pro</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="pt-4">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">Plano Básico</h3>
                <p className="text-3xl font-bold mt-2">R$ 19,90<span className="text-sm font-normal">/mês</span></p>
                <p className="text-sm text-gray-500 mt-1">Acesso a funcionalidades básicas</p>
              </div>
              
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Acesso a dados históricos</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Visualização de roletas básicas</span>
                </li>
              </ul>
            </TabsContent>
            
            <TabsContent value="pro" className="pt-4">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">Plano Pro</h3>
                <p className="text-3xl font-bold mt-2">R$ 49,90<span className="text-sm font-normal">/mês</span></p>
                <p className="text-sm text-gray-500 mt-1">Acesso a funcionalidades avançadas</p>
              </div>
              
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Todas as funções do plano Básico</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Análises avançadas de tendências</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Exportação de dados</span>
                </li>
              </ul>
            </TabsContent>
            
            <TabsContent value="premium" className="pt-4">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">Plano Premium</h3>
                <p className="text-3xl font-bold mt-2">R$ 99,90<span className="text-sm font-normal">/mês</span></p>
                <p className="text-sm text-gray-500 mt-1">Acesso completo a todas as funcionalidades</p>
              </div>
              
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Todas as funções do plano Pro</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Suporte prioritário</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Acesso antecipado a novas funcionalidades</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                  <span>Sem limites de uso</span>
                </li>
              </ul>
            </TabsContent>
          </Tabs>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Sucesso</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            className="w-full" 
            disabled={processing || !customerId} 
            onClick={handleCreateSubscription}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : "Assinar Plano"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Renderizar pagamento
  const renderPayment = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Pagamento por PIX</CardTitle>
        <CardDescription>
          Escaneie o QR Code ou copie o código PIX para completar o pagamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {pixQrCode ? (
            <div className="flex flex-col items-center">
              {pixQrCode.image && (
                <div className="mb-4 p-4 bg-white rounded-lg">
                  <img 
                    src={`data:image/png;base64,${pixQrCode.image}`} 
                    alt="QR Code PIX" 
                    className="w-48 h-48"
                  />
                </div>
              )}
              
              {pixQrCode.text && (
                <div className="w-full">
                  <div className="relative">
                    <Input
                      type="text"
                      value={pixQrCode.text}
                      readOnly
                      className="pr-24"
                    />
                    <Button
                      className="absolute right-0 top-0 h-full rounded-l-none"
                      onClick={() => {
                        navigator.clipboard.writeText(pixQrCode.text);
                        setSuccess('Código PIX copiado para a área de transferência');
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              )}
              
              {pixQrCode.expirationDate && (
                <p className="text-sm text-gray-500 mt-2">
                  Expira em: {new Date(pixQrCode.expirationDate).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium">Status do pagamento: {subscriptionStatus || 'Pendente'}</h4>
            <p className="text-sm text-gray-500 mt-1">
              Após o pagamento, aguarde alguns instantes para a confirmação automática.
            </p>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Sucesso</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Renderizar verificação
  const renderVerification = () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Verificação de Assinatura</CardTitle>
        <CardDescription>
          Teste o acesso aos dados protegidos de roletas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium">Status da assinatura</h4>
            <div className="mt-2">
              <p><strong>Plano atual:</strong> {currentPlan?.name || 'Carregando...'}</p>
              <p><strong>Status:</strong> {
                // @ts-ignore - Propriedade status pode existir em runtime
                currentPlan?.status || 'Desconhecido'
              }</p>
              <p><strong>Validade:</strong> {
                // @ts-ignore - Propriedade expirationDate pode existir em runtime
                currentPlan?.expirationDate ? new Date(currentPlan.expirationDate).toLocaleDateString() : 'N/A'
              }</p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              className="flex-1" 
              disabled={loadingRoulettes} 
              onClick={testRouletteAccess}
            >
              {loadingRoulettes ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando acesso...
                </>
              ) : "Testar Acesso às Roletas"}
            </Button>
            
            <Button
              className="flex-1"
              variant="outline"
              disabled={loadingSubscriptionDetails}
              onClick={fetchSubscriptionDetails}
            >
              {loadingSubscriptionDetails ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : "Detalhes da Assinatura"}
            </Button>
          </div>
          
          {subscriptionDetails && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Informações Detalhadas da Assinatura</h4>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <p><strong>ID da Assinatura:</strong> {subscriptionDetails.id || 'N/A'}</p>
                <p><strong>Data de Criação:</strong> {subscriptionDetails.dateCreated ? new Date(subscriptionDetails.dateCreated).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Próximo Vencimento:</strong> {subscriptionDetails.nextDueDate ? new Date(subscriptionDetails.nextDueDate).toLocaleDateString() : 'N/A'}</p>
                <p><strong>Valor:</strong> R$ {subscriptionDetails.value?.toFixed(2) || 'N/A'}</p>
                <p><strong>Ciclo:</strong> {
                  subscriptionDetails.cycle === 'MONTHLY' ? 'Mensal' :
                  subscriptionDetails.cycle === 'YEARLY' ? 'Anual' :
                  subscriptionDetails.cycle === 'WEEKLY' ? 'Semanal' :
                  subscriptionDetails.cycle === 'BIWEEKLY' ? 'Quinzenal' :
                  subscriptionDetails.cycle === 'QUARTERLY' ? 'Trimestral' :
                  subscriptionDetails.cycle === 'SEMIANNUALLY' ? 'Semestral' :
                  subscriptionDetails.cycle || 'N/A'
                }</p>
                <p><strong>Forma de Pagamento:</strong> {
                  subscriptionDetails.billingType === 'BOLETO' ? 'Boleto' :
                  subscriptionDetails.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' :
                  subscriptionDetails.billingType === 'PIX' ? 'PIX' :
                  subscriptionDetails.billingType || 'N/A'
                }</p>
                <p><strong>Status:</strong> {
                  subscriptionDetails.status === 'ACTIVE' ? 'Ativa' :
                  subscriptionDetails.status === 'INACTIVE' ? 'Inativa' :
                  subscriptionDetails.status === 'CANCELLED' ? 'Cancelada' :
                  subscriptionDetails.status === 'OVERDUE' ? 'Em atraso' :
                  subscriptionDetails.status || 'N/A'
                }</p>
                <p><strong>Descrição:</strong> {subscriptionDetails.description || 'N/A'}</p>
                
                {subscriptionDetails.fine && (
                  <p><strong>Multa:</strong> {subscriptionDetails.fine}%</p>
                )}
                
                {subscriptionDetails.interest && (
                  <p><strong>Juros:</strong> {subscriptionDetails.interest}% ao mês</p>
                )}
                
                {subscriptionDetails.discount && (
                  <div>
                    <p><strong>Desconto:</strong> {
                      subscriptionDetails.discount.type === 'FIXED' ? 
                      `R$ ${subscriptionDetails.discount.value?.toFixed(2)}` : 
                      `${subscriptionDetails.discount.value}%`
                    }</p>
                    <p><strong>Validade do desconto:</strong> {
                      subscriptionDetails.discount.dueDateLimitDays ? 
                      `Até ${subscriptionDetails.discount.dueDateLimitDays} dias antes do vencimento` : 
                      'Sem limite'
                    }</p>
                  </div>
                )}
                
                {subscriptionDetails.errorCode && (
                  <div className="mt-2 text-red-600">
                    <p><strong>Código de Erro:</strong> {subscriptionDetails.errorCode}</p>
                    <p><strong>Mensagem:</strong> {decodeAsaasError(subscriptionDetails.errorCode)}</p>
                  </div>
                )}
              </div>
              
              {subscriptionDetails.creditCard && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Informações do Cartão</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                    <p><strong>Bandeira:</strong> {subscriptionDetails.creditCard.creditCardBrand || 'N/A'}</p>
                    <p><strong>Últimos dígitos:</strong> {subscriptionDetails.creditCard.creditCardNumber || 'N/A'}</p>
                    <p><strong>Validade:</strong> {
                      subscriptionDetails.creditCard.creditCardExpiryMonth && 
                      subscriptionDetails.creditCard.creditCardExpiryYear ? 
                      `${subscriptionDetails.creditCard.creditCardExpiryMonth}/${subscriptionDetails.creditCard.creditCardExpiryYear}` : 
                      'N/A'
                    }</p>
                  </div>
                </div>
              )}
              
              {webhookEvents && webhookEvents.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Eventos Recentes da Assinatura</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-4 text-sm max-h-60 overflow-y-auto">
                    {webhookEvents.map((event, index) => (
                      <div key={index} className="border-b pb-2 last:border-b-0 last:pb-0">
                        <p><strong>Evento:</strong> {event.event || 'N/A'}</p>
                        <p><strong>Data:</strong> {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A'}</p>
                        {event.status && <p><strong>Status:</strong> {event.status}</p>}
                        {event.value && <p><strong>Valor:</strong> R$ {parseFloat(event.value).toFixed(2)}</p>}
                        {event.errorCode && (
                          <p className="text-red-600">
                            <strong>Erro:</strong> {decodeAsaasError(event.errorCode)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {accessStatus && (
            <Alert 
              variant={accessStatus.canAccess ? "default" : "destructive"} 
              className={accessStatus.canAccess ? "bg-green-50 text-green-800 border-green-200" : ""}
            >
              {accessStatus.canAccess 
                ? <CheckCircle className="h-4 w-4" />
                : <AlertCircle className="h-4 w-4" />
              }
              <AlertTitle>{accessStatus.canAccess ? "Acesso Confirmado" : "Acesso Negado"}</AlertTitle>
              <AlertDescription>{accessStatus.message}</AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Sucesso</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          {rouletteData && (
            <div>
              <h4 className="font-medium mb-2">Dados de Roletas (Amostra)</h4>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-40">
                <pre className="text-xs">
                  {JSON.stringify(
                    Array.isArray(rouletteData) && rouletteData.length > 3 
                      ? rouletteData.slice(0, 3) 
                      : rouletteData, 
                    null, 2
                  )}
                </pre>
              </div>
            </div>
          )}
          
          {subscriptionDetails && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Diagnóstico de Assinatura</h4>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <p className={`${
                  subscriptionDetails.status === 'ACTIVE' 
                    ? 'text-green-600' 
                    : 'text-amber-600'
                }`}>
                  <strong>Status de Verificação:</strong> {
                    subscriptionDetails.status === 'ACTIVE' 
                      ? '✅ Assinatura ativa e válida.' 
                      : subscriptionDetails.status === 'INACTIVE'
                        ? '⚠️ Assinatura inativa. Verifique o pagamento.'
                        : subscriptionDetails.status === 'CANCELLED'
                          ? '❌ Assinatura cancelada. Nova assinatura é necessária.'
                          : '⚠️ Status desconhecido. Verifique junto ao suporte.'
                  }
                </p>
                
                <p className={`${
                  subscriptionDetails.nextDueDate && new Date(subscriptionDetails.nextDueDate) > new Date()
                    ? 'text-green-600'
                    : 'text-amber-600'
                }`}>
                  <strong>Validade:</strong> {
                    subscriptionDetails.nextDueDate 
                      ? new Date(subscriptionDetails.nextDueDate) > new Date()
                        ? `✅ Válida até ${new Date(subscriptionDetails.nextDueDate).toLocaleDateString()}`
                        : `⚠️ Vencida em ${new Date(subscriptionDetails.nextDueDate).toLocaleDateString()}`
                      : '❓ Data de vencimento não disponível'
                  }
                </p>
                
                <p className="mt-2 text-sm">
                  <strong>Ações recomendadas:</strong>
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {subscriptionDetails.status !== 'ACTIVE' && (
                    <li>Verificar status do pagamento no sistema Asaas</li>
                  )}
                  {subscriptionDetails.errorCode && (
                    <li>Resolver problema: {decodeAsaasError(subscriptionDetails.errorCode)}</li>
                  )}
                  {(!subscriptionDetails.nextDueDate || new Date(subscriptionDetails.nextDueDate) <= new Date()) && (
                    <li>Renovar assinatura ou verificar pagamento pendente</li>
                  )}
                  {webhookEvents && webhookEvents.length === 0 && (
                    <li>Verificar configuração de webhooks no Asaas</li>
                  )}
                  {webhookEvents && webhookEvents.some(event => event.errorCode) && (
                    <li>Resolver erros de webhook reportados no painel Asaas</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Renderizar o progresso
  const renderProgress = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className={`flex flex-col items-center ${step === 'register' ? 'text-blue-600' : 'text-gray-500'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step === 'register' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
          }`}>
            1
          </div>
          <span className="text-xs mt-1">Cadastro</span>
        </div>
        
        <div className={`flex-1 h-1 ${
          ['customer', 'subscription', 'payment', 'verification'].includes(step) 
            ? 'bg-blue-600' : 'bg-gray-200'
        }`}></div>
        
        <div className={`flex flex-col items-center ${step === 'customer' ? 'text-blue-600' : 'text-gray-500'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step === 'customer' ? 'bg-blue-100 text-blue-600' : 
            ['subscription', 'payment', 'verification'].includes(step) ? 'bg-green-100 text-green-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            2
          </div>
          <span className="text-xs mt-1">Cliente</span>
        </div>
        
        <div className={`flex-1 h-1 ${
          ['subscription', 'payment', 'verification'].includes(step) 
            ? 'bg-blue-600' : 'bg-gray-200'
        }`}></div>
        
        <div className={`flex flex-col items-center ${step === 'subscription' ? 'text-blue-600' : 'text-gray-500'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step === 'subscription' ? 'bg-blue-100 text-blue-600' : 
            ['payment', 'verification'].includes(step) ? 'bg-green-100 text-green-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            3
          </div>
          <span className="text-xs mt-1">Plano</span>
        </div>
        
        <div className={`flex-1 h-1 ${
          ['payment', 'verification'].includes(step) 
            ? 'bg-blue-600' : 'bg-gray-200'
        }`}></div>
        
        <div className={`flex flex-col items-center ${step === 'payment' ? 'text-blue-600' : 'text-gray-500'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step === 'payment' ? 'bg-blue-100 text-blue-600' : 
            step === 'verification' ? 'bg-green-100 text-green-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            4
          </div>
          <span className="text-xs mt-1">Pagamento</span>
        </div>
        
        <div className={`flex-1 h-1 ${
          step === 'verification' ? 'bg-blue-600' : 'bg-gray-200'
        }`}></div>
        
        <div className={`flex flex-col items-center ${step === 'verification' ? 'text-blue-600' : 'text-gray-500'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            step === 'verification' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
          }`}>
            5
          </div>
          <span className="text-xs mt-1">Verificação</span>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Teste de Assinatura</h1>

        {step === 'register' && renderRegisterForm()}
        {step === 'customer' && renderCustomerCreation()}
        {step === 'subscription' && renderSubscriptionSelection()}
        {step === 'payment' && renderPayment()}
        {step === 'verification' && renderVerification()}

        {renderProgress()}
      </div>
    </Layout>
  );
};

export default TestAssinaturaPage;