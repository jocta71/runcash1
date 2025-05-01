import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createAsaasSubscription } from '@/integrations/asaas/client';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

// Estilos CSS locais (adicionados no início do arquivo)
const styles = `
@keyframes progress {
  0% { width: 0% }
  50% { width: 30% }
  80% { width: 70% }
  100% { width: 100% }
}

.animate-progress {
  animation: progress 3s ease-in-out forwards;
}
`;

// Adicionar type para User para resolver o erro de propriedade 'name'
interface User {
  id: string;
  email?: string;
  asaasCustomerId?: string;
  name?: string;
  username?: string;
}

interface RouletteData {
  id: string;
  nome: string;
}

interface TestStepProps {
  title: string;
  description: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
  children: React.ReactNode;
}

const TestStep: React.FC<TestStepProps> = ({ title, description, status, error, children }) => {
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{title}</CardTitle>
          {status === 'loading' && <Loader2 className="animate-spin text-blue-500" />}
          {status === 'success' && <CheckCircle2 className="text-green-500" />}
          {status === 'error' && <XCircle className="text-red-500" />}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'error' && error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {children}
      </CardContent>
    </Card>
  );
};

const TestFluxoCompleto: React.FC = () => {
  // Estados para controle do fluxo
  const [activeTab, setActiveTab] = useState('cadastro');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [rouletteData, setRouletteData] = useState<RouletteData[]>([]);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [processando, setProcessando] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false); // Nova flag para modo de simulação

  // Estados para status dos passos
  const [registroStatus, setRegistroStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [planoStatus, setPlanoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pagamentoStatus, setPagamentoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [acessoStatus, setAcessoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Estados para mensagens de erro
  const [registroError, setRegistroError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [planoError, setPlanoError] = useState('');
  const [pagamentoError, setPagamentoError] = useState('');
  const [acessoError, setAcessoError] = useState('');

  // Adicionar estados para diagnóstico
  const [pollingPausado, setPollingPausado] = useState<boolean>(false);
  const [modalFechado, setModalFechado] = useState<boolean>(false);

  // Hooks
  const navigate = useNavigate();
  const { user, signIn: login, signUp: register } = useAuth();
  const { toast } = useToast();
  const { currentSubscription, loadUserSubscription } = useSubscription();
  
  // Cast do user para nosso tipo customizado quando necessário
  const userWithName = user as User | null;

  // Efeito para verificar autenticação e assinatura
  useEffect(() => {
    if (user) {
      setLoginStatus('success');
      loadUserSubscription();
      
      // Se já estiver autenticado, avança para a aba de planos
      if (activeTab === 'cadastro' || activeTab === 'login') {
        setActiveTab('planos');
      }
    }
  }, [user, activeTab]);

  // Efeito para verificar assinatura
  useEffect(() => {
    if (currentSubscription && currentSubscription.status === 'ACTIVE') {
      setPlanoStatus('success');
      setPagamentoStatus('success');
      
      // Se já tiver assinatura ativa, avança para a aba de acesso
      if (activeTab === 'planos' || activeTab === 'pagamento') {
        setActiveTab('acesso');
      }
    }
  }, [currentSubscription, activeTab]);

  // Efeito para verificar status do polling e do modal
  useEffect(() => {
    // Verificar status do polling
    const pollingStatus = localStorage.getItem('roulette_polling_paused');
    setPollingPausado(pollingStatus === 'true');
    
    // Verificar status do modal
    const modalStatus = localStorage.getItem('subscription_modal_closed');
    setModalFechado(modalStatus === 'true');
    
    // Verificar a cada 2 segundos
    const interval = setInterval(() => {
      const currentPollingStatus = localStorage.getItem('roulette_polling_paused');
      setPollingPausado(currentPollingStatus === 'true');
      
      const currentModalStatus = localStorage.getItem('subscription_modal_closed');
      setModalFechado(currentModalStatus === 'true');
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Função para registro
  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistroStatus('loading');
    setRegistroError('');
    
    try {
      await register(username, email, password);
      setRegistroStatus('success');
      toast({
        title: "Cadastro realizado com sucesso!",
        description: "Você já pode fazer login e contratar um plano.",
      });
      setActiveTab('login');
    } catch (error: any) {
      setRegistroStatus('error');
      setRegistroError(error.message || 'Erro ao realizar cadastro');
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: error.message || 'Ocorreu um erro ao tentar realizar o cadastro.',
      });
    }
  };

  // Função para login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginStatus('loading');
    setLoginError('');
    
    try {
      await login(email, password);
      setLoginStatus('success');
      toast({
        title: "Login realizado com sucesso!",
        description: "Você já pode contratar um plano.",
      });
      setActiveTab('planos');
    } catch (error: any) {
      setLoginStatus('error');
      setLoginError(error.message || 'Credenciais inválidas');
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: error.message || 'Ocorreu um erro ao tentar realizar o login.',
      });
    }
  };

  // Função para seleção de plano
  const handleSelecionarPlano = () => {
    setPlanoStatus('success');
    setActiveTab('pagamento');
  };

  // Função para criar checkout
  const handleCriarCheckout = async () => {
    setPagamentoStatus('loading');
    setPagamentoError('');
    
    // Usar o modo de simulação se ativado pelo usuário
    if (simulationMode) {
      console.log('[Checkout] Modo de simulação ativo - ignorando integração com Asaas');
      
      // Simular um breve delay para parecer que estamos processando algo
      setTimeout(() => {
        setPagamentoStatus('success');
        setCheckoutUrl('https://sandbox.asaas.com/payment/simulation');
        
        toast({
          title: "Checkout simulado criado",
          description: "Esta é uma simulação para fins de teste. Nenhuma integração real foi feita.",
        });
        
        // Simular pagamento bem-sucedido após alguns segundos
        setTimeout(() => {
          handlePagamentoSimulado();
        }, 3000);
      }, 1500);
      
      return;
    }
    
    // Resto do código original para integração real com Asaas
    try {
      // Verificar se o usuário está logado
      if (!userWithName || !userWithName.id) {
        throw new Error('Usuário não está autenticado. Faça login primeiro.');
      }
      
      // Verificar se o usuário tem ID do Asaas
      if (!userWithName.asaasCustomerId) {
        // Se não tiver ID do Asaas, você pode tentar criar o cliente primeiro
        toast({
          variant: "destructive",
          title: "ID do cliente Asaas não encontrado",
          description: "Tentando criar cliente no Asaas primeiro...",
        });
        
        // Aqui você poderia chamar uma API para criar o cliente no Asaas
        // Como solução temporária, vamos continuar sem o ID para fins de teste
      }
      
      // Montar o objeto de dados com valores padrão para evitar undefined
      const checkoutData = {
        planId: selectedPlan || 'basic',
        userId: userWithName.id,
        customerId: userWithName.asaasCustomerId || '', // Usar string vazia se não existir
        billingType: 'PIX',
        name: userWithName.name || username || email, // Garantir que temos um nome
        email: email || userWithName.email || '' // Garantir que temos um email
      };
      
      console.log('[Checkout] Enviando dados para criação de assinatura:', checkoutData);
      
      const response = await axios.post(`${API_URL}/api/asaas-create-subscription`, checkoutData);
      
      console.log('[Checkout] Resposta recebida:', response.data);
      
      if (response.data && response.data.redirectUrl) {
        setCheckoutUrl(response.data.redirectUrl);
        setPagamentoStatus('success');
        toast({
          title: "Checkout criado com sucesso!",
          description: "Você será redirecionado para a página de pagamento.",
        });
        
        // Simular pagamento bem-sucedido após 5 segundos para demonstração
        setTimeout(() => {
          handlePagamentoSimulado();
        }, 5000);
      } else {
        console.warn('[Checkout] Resposta sem URL de redirecionamento:', response.data);
        throw new Error('URL de checkout não recebida. A resposta da API está incompleta.');
      }
    } catch (error: any) {
      console.error('[Checkout] Erro completo:', error);
      
      // Extrair informações detalhadas da resposta de erro
      const responseData = error.response?.data;
      console.error('[Checkout] Resposta de erro do servidor:', responseData);
      
      // Tentar extrair mensagem específica ou usar mensagem genérica
      let errorMessage = 'Erro ao criar checkout';
      
      if (responseData) {
        if (typeof responseData === 'string') {
          errorMessage = responseData;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.error) {
          errorMessage = responseData.error;
        } else if (responseData.errors && responseData.errors.length > 0) {
          // Muitas APIs retornam um array de erros
          errorMessage = responseData.errors.map((e: any) => e.message || e).join('. ');
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setPagamentoStatus('error');
      setPagamentoError(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Erro no checkout",
        description: errorMessage,
      });
      
      // Caso o erro seja relacionado a problema de autenticação, sugerir relogin
      if (error.response?.status === 401 || errorMessage.includes('autenticado') || errorMessage.includes('token')) {
        toast({
          variant: "destructive",
          title: "Problema de autenticação",
          description: "Tente fazer logout e login novamente.",
        });
      }
      
      // Se for erro específico do Asaas, oferecer solução alternativa
      if (errorMessage.includes('Asaas') || error.response?.status === 400) {
        toast({
          variant: "destructive",
          title: "Problema com a integração Asaas",
          description: "Para fins de teste, você pode clicar em 'Simular Pagamento' abaixo para continuar.",
        });
        
        // Adicionar botão para simular pagamento diretamente
        setPagamentoStatus('error');
      }
    }
  };

  // Função para simular pagamento bem-sucedido (para fins de teste)
  const handlePagamentoSimulado = async () => {
    setPagamentoStatus('success');
    toast({
      title: "Pagamento realizado com sucesso!",
      description: "Sua assinatura está ativa. Você já pode acessar os dados das roletas.",
    });
    
    // Atualizar assinatura
    await loadUserSubscription();
    
    // Avançar para a aba de acesso
    setActiveTab('acesso');
  };

  // Função para testar acesso às roletas
  const handleTestarAcesso = async () => {
    setAcessoStatus('loading');
    setAcessoError('');
    
    try {
      const response = await axios.get(`${API_URL}/api/roulettes`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setRouletteData(response.data);
      setAcessoStatus('success');
      toast({
        title: "Acesso liberado!",
        description: `Foram encontradas ${response.data.length} roletas disponíveis.`,
      });
    } catch (error: any) {
      setAcessoStatus('error');
      setAcessoError(error.response?.data?.message || error.message || 'Erro ao acessar dados das roletas');
      toast({
        variant: "destructive",
        title: "Erro de acesso",
        description: error.response?.data?.message || error.message || 'Ocorreu um erro ao tentar acessar os dados das roletas.',
      });
    }
  };

  // Função para forçar uma requisição de roletas
  const forcarAcessoRoletas = async () => {
    try {
      toast({
        title: "Forçando acesso",
        description: "Tentando acessar a API de roletas...",
      });
      
      const response = await axios.get(`${API_URL}/api/roulettes`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      toast({
        title: "Acesso bem-sucedido!",
        description: `Foram encontradas ${response.data.length} roletas disponíveis.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro de acesso",
        description: error.response?.data?.message || error.message || 'Ocorreu um erro ao tentar acessar os dados das roletas.',
      });
    }
  };
  
  // Função para limpar o status do modal
  const limparStatusModal = () => {
    localStorage.removeItem('subscription_modal_closed');
    localStorage.removeItem('subscription_modal_last_shown');
    setModalFechado(false);
    
    toast({
      title: "Status do modal limpo",
      description: "O status do modal foi resetado.",
    });
  };
  
  // Função para limpar o status do polling
  const limparStatusPolling = () => {
    localStorage.removeItem('roulette_polling_paused');
    setPollingPausado(false);
    
    toast({
      title: "Status do polling limpo",
      description: "O status do polling foi resetado.",
    });
  };
  
  // Função para retomar o polling manualmente
  const retomarPolling = async () => {
    try {
      const { default: globalRouletteDataService } = await import('@/services/GlobalRouletteDataService');
      globalRouletteDataService.resumePollingManually();
      
      setPollingPausado(false);
      localStorage.removeItem('roulette_polling_paused');
      
      toast({
        title: "Polling retomado",
        description: "O polling de dados de roletas foi retomado manualmente.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao retomar polling",
        description: error.message || 'Ocorreu um erro ao tentar retomar o polling.',
      });
    }
  };

  // Função para simular a criação de um Customer ID do Asaas
  const handleSimulateAsaasCustomer = async () => {
    if (!userWithName) {
      toast({
        variant: "destructive",
        title: "Erro de autenticação",
        description: "Usuário não está logado."
      });
      return;
    }
    
    // Mostrar feedback
    setProcessando(true);
    toast({
      title: "Simulando criação de cliente",
      description: "Criando ID de cliente simulado no Asaas..."
    });
    
    try {
      // Criar um ID falso que parece real
      const fakeCustomerId = `cus_${Math.random().toString(36).substring(2, 10)}${Date.now().toString().substring(9)}`;
      
      // Simular uma chamada ao backend
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Atualizar o localStorage para simular um estado real
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      userData.asaasCustomerId = fakeCustomerId;
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Atualizar a tela
      toast({
        title: "Cliente simulado criado",
        description: `ID do cliente Asaas simulado: ${fakeCustomerId}`
      });
      
      // Recarregar a página para obter o novo estado de usuário
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na simulação",
        description: "Não foi possível simular a criação do cliente."
      });
    } finally {
      setProcessando(false);
    }
  };

  // Função para alternar modo de simulação
  const toggleSimulationMode = () => {
    setSimulationMode(!simulationMode);
    toast({
      title: simulationMode ? "Modo normal ativado" : "Modo de simulação ativado",
      description: simulationMode ? 
        "Tentando usar integrações reais quando possível." : 
        "Simulando APIs para testes sem dependências externas."
    });
  };

  return (
    <div className="container mx-auto py-8">
      {/* Adicionar os estilos CSS diretamente no componente */}
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      
      <h1 className="text-3xl font-bold mb-6 text-center">Teste de Fluxo Completo - RunCash</h1>
      <p className="text-center mb-8 text-gray-600">
        Esta página permite testar todo o fluxo de cadastro, assinatura e acesso aos dados de roletas.
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="cadastro">1. Cadastro</TabsTrigger>
          <TabsTrigger value="login">2. Login</TabsTrigger>
          <TabsTrigger value="planos">3. Planos</TabsTrigger>
          <TabsTrigger value="pagamento">4. Pagamento</TabsTrigger>
          <TabsTrigger value="acesso">5. Acesso</TabsTrigger>
        </TabsList>

        {/* Aba de Cadastro */}
        <TabsContent value="cadastro">
          <TestStep 
            title="Cadastro de Usuário" 
            description="Preencha os dados para criar uma nova conta no sistema." 
            status={registroStatus}
            error={registroError}
          >
            <form onSubmit={handleRegistro} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">Nome de Usuário</label>
                <Input 
                  id="username" 
                  type="text" 
                  placeholder="Seu nome de usuário" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">E-mail</label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu-email@exemplo.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Senha</label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Sua senha" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>

              <Button type="submit" className="w-full" disabled={registroStatus === 'loading'}>
                {registroStatus === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : 'Cadastrar'}
              </Button>
            </form>
          </TestStep>
        </TabsContent>

        {/* Aba de Login */}
        <TabsContent value="login">
          <TestStep 
            title="Login de Usuário" 
            description="Entre com suas credenciais para acessar o sistema." 
            status={loginStatus}
            error={loginError}
          >
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email-login" className="text-sm font-medium">E-mail</label>
                <Input 
                  id="email-login" 
                  type="email" 
                  placeholder="seu-email@exemplo.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password-login" className="text-sm font-medium">Senha</label>
                <Input 
                  id="password-login" 
                  type="password" 
                  placeholder="Sua senha" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>

              <Button type="submit" className="w-full" disabled={loginStatus === 'loading'}>
                {loginStatus === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : 'Entrar'}
              </Button>
            </form>
          </TestStep>
        </TabsContent>

        {/* Aba de Planos */}
        <TabsContent value="planos">
          <TestStep 
            title="Seleção de Plano" 
            description="Escolha o plano que melhor atende suas necessidades." 
            status={planoStatus}
            error={planoError}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Plano Basic */}
              <Card className={`border-2 ${selectedPlan === 'basic' ? 'border-primary' : 'border-transparent'}`}>
                <CardHeader>
                  <CardTitle>Básico</CardTitle>
                  <CardDescription>Ideal para iniciantes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-4">R$ 19,90<span className="text-sm font-normal">/mês</span></div>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Acesso a dados em tempo real
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Histórico de 100 jogadas
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Estatísticas básicas
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant={selectedPlan === 'basic' ? 'default' : 'outline'} 
                    className="w-full"
                    onClick={() => setSelectedPlan('basic')}
                  >
                    {selectedPlan === 'basic' ? 'Selecionado' : 'Selecionar'}
                  </Button>
                </CardFooter>
              </Card>

              {/* Plano Pro */}
              <Card className={`border-2 ${selectedPlan === 'pro' ? 'border-primary' : 'border-transparent'}`}>
                <CardHeader>
                  <CardTitle>Pro</CardTitle>
                  <CardDescription>Para usuários avançados</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-4">R$ 49,90<span className="text-sm font-normal">/mês</span></div>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Tudo do plano Básico
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Histórico de 500 jogadas
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Estatísticas avançadas
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Alertas personalizados
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant={selectedPlan === 'pro' ? 'default' : 'outline'} 
                    className="w-full"
                    onClick={() => setSelectedPlan('pro')}
                  >
                    {selectedPlan === 'pro' ? 'Selecionado' : 'Selecionar'}
                  </Button>
                </CardFooter>
              </Card>

              {/* Plano Premium */}
              <Card className={`border-2 ${selectedPlan === 'premium' ? 'border-primary' : 'border-transparent'}`}>
                <CardHeader>
                  <CardTitle>Premium</CardTitle>
                  <CardDescription>Experiência completa</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-4">R$ 99,90<span className="text-sm font-normal">/mês</span></div>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Tudo do plano Pro
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Histórico ilimitado
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Suporte prioritário
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Acesso a estratégias exclusivas
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Análise preditiva avançada
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant={selectedPlan === 'premium' ? 'default' : 'outline'} 
                    className="w-full"
                    onClick={() => setSelectedPlan('premium')}
                  >
                    {selectedPlan === 'premium' ? 'Selecionado' : 'Selecionar'}
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <Button className="w-full" onClick={handleSelecionarPlano}>
              Continuar para o Pagamento
            </Button>
          </TestStep>
        </TabsContent>

        {/* Aba de Pagamento */}
        <TabsContent value="pagamento">
          <TestStep 
            title="Pagamento" 
            description="Realize o pagamento para ativar sua assinatura." 
            status={pagamentoStatus}
            error={pagamentoError}
          >
            <div className="mb-6">
              {/* Botão de modo simulação */}
              <div className="mb-4 flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={toggleSimulationMode}
                  className="flex items-center space-x-1 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {simulationMode ? 'Desativar Simulação' : 'Ativar Simulação'}
                </Button>
              </div>
              
              <div className="bg-gray-100 p-4 rounded mb-4">
                <h3 className="font-medium mb-2">Resumo da compra</h3>
                <div className="flex justify-between mb-2">
                  <span>Plano selecionado:</span>
                  <span className="font-medium capitalize">{selectedPlan}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Valor mensal:</span>
                  <span className="font-medium">
                    {selectedPlan === 'basic' ? 'R$ 19,90' : 
                     selectedPlan === 'pro' ? 'R$ 49,90' : 
                     selectedPlan === 'premium' ? 'R$ 99,90' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Método de pagamento:</span>
                  <span className="font-medium">PIX</span>
                </div>
              </div>
              
              {/* Status do usuário no Asaas */}
              {userWithName && (
                <div className="bg-gray-50 p-3 rounded-md mb-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Status Asaas:</span>
                    <span className={userWithName.asaasCustomerId ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                      {userWithName.asaasCustomerId ? 'Cliente registrado' : 'Cliente não registrado'}
                    </span>
                  </div>
                  {userWithName.asaasCustomerId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID Cliente:</span>
                      <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">{userWithName.asaasCustomerId}</span>
                    </div>
                  )}
                  {!userWithName.asaasCustomerId && simulationMode && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2 text-xs"
                      onClick={handleSimulateAsaasCustomer}
                      disabled={processando}
                    >
                      {processando ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Simulando...
                        </>
                      ) : (
                        'Simular criação de cliente'
                      )}
                    </Button>
                  )}
                </div>
              )}

              {!checkoutUrl ? (
                <div className="space-y-4">
                  <Button 
                    className="w-full" 
                    onClick={handleCriarCheckout}
                    disabled={pagamentoStatus === 'loading'}
                  >
                    {pagamentoStatus === 'loading' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : simulationMode ? 'Simular Pagamento' : 'Gerar Checkout'}
                  </Button>
                  
                  {pagamentoStatus === 'error' && (
                    <Button 
                      className="w-full mt-4" 
                      variant="secondary"
                      onClick={handlePagamentoSimulado}
                    >
                      Simular Pagamento (Bypass Checkout)
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className={`${simulationMode ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
                    <AlertTitle>{simulationMode ? 'Simulação de Checkout' : 'Checkout gerado com sucesso!'}</AlertTitle>
                    <AlertDescription className="mt-2">
                      <p className="mb-2">
                        {simulationMode 
                          ? 'Simulando processamento de pagamento para fins de teste.' 
                          : 'Para fins deste teste, o pagamento será simulado automaticamente em 5 segundos.'}
                      </p>
                      <p className="text-sm text-gray-500">
                        URL de checkout: <span className="font-mono text-xs">{checkoutUrl}</span>
                      </p>
                    </AlertDescription>
                  </Alert>
                  
                  {simulationMode ? (
                    <div className="flex flex-col items-center p-6 bg-gray-50 rounded-md border border-gray-200">
                      <div className="mb-4 flex flex-col items-center">
                        {/* QR Code falso */}
                        <div className="w-48 h-48 bg-white p-2 border border-gray-300 relative mb-3">
                          <div className="absolute inset-4 grid grid-cols-10 grid-rows-10 gap-0.5">
                            {Array.from({ length: 100 }).map((_, i) => (
                              <div 
                                key={i} 
                                className={`${Math.random() > 0.7 ? 'bg-black' : 'bg-transparent'} 
                                  ${i === 0 || i === 9 || i === 90 || i === 99 ? 'bg-black' : ''}`}
                              />
                            ))}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            {simulationMode && (
                              <div className="bg-white bg-opacity-70 px-2 py-1 rounded text-xs font-bold text-purple-700">
                                SIMULAÇÃO
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-medium">Escaneie o QR Code para simular o pagamento</p>
                      </div>
                      
                      <div className="w-full space-y-4">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-primary h-2.5 rounded-full animate-progress"></div>
                        </div>
                        
                        <div className="flex items-center justify-center">
                          <Loader2 className="animate-spin mr-2" />
                          <span>Simulando pagamento via PIX...</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-4 bg-gray-50 rounded-md">
                      <Loader2 className="animate-spin mr-2" />
                      <span>Simulando pagamento via PIX...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TestStep>
        </TabsContent>

        {/* Aba de Acesso */}
        <TabsContent value="acesso">
          <TestStep 
            title="Acesso às Roletas" 
            description="Teste o acesso aos dados das roletas com sua assinatura ativa." 
            status={acessoStatus}
            error={acessoError}
          >
            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded">
                <h3 className="font-medium mb-2">Status da Assinatura</h3>
                <div className="flex justify-between mb-2">
                  <span>Plano:</span>
                  <span className="font-medium capitalize">{currentSubscription?.planType || 'Nenhum'}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Status:</span>
                  <span className={`font-medium ${currentSubscription?.status === 'ACTIVE' ? 'text-green-500' : 'text-yellow-500'}`}>
                    {currentSubscription?.status || 'Inativo'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Próxima cobrança:</span>
                  <span className="font-medium">
                    {currentSubscription?.nextBillingDate ? new Date(currentSubscription.nextBillingDate).toLocaleDateString() : 'N/D'}
                  </span>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={handleTestarAcesso}
                disabled={acessoStatus === 'loading'}
              >
                {acessoStatus === 'loading' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Acessando dados...
                  </>
                ) : 'Testar Acesso às Roletas'}
              </Button>

              {acessoStatus === 'success' && rouletteData.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Roletas Disponíveis ({rouletteData.length})</h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <ul className="divide-y">
                      {rouletteData.map((roleta) => (
                        <li key={roleta.id} className="py-2 flex justify-between">
                          <span>{roleta.nome}</span>
                          <span className="text-gray-500 text-sm">{roleta.id}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Área de diagnóstico para testar o modal */}
              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">Diagnóstico do Modal de Assinatura</h3>
                <Card>
                  <CardHeader>
                    <CardTitle>Status atual</CardTitle>
                    <CardDescription>Verifique e controle o comportamento do modal de assinatura</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border rounded p-3">
                          <div className="font-medium">Status do Polling</div>
                          <div className={`flex items-center mt-2 ${pollingPausado ? 'text-yellow-500' : 'text-green-500'}`}>
                            {pollingPausado ? (
                              <>
                                <AlertTriangle className="h-5 w-5 mr-2" />
                                Pausado
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                Ativo
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="border rounded p-3">
                          <div className="font-medium">Status do Modal</div>
                          <div className={`flex items-center mt-2 ${modalFechado ? 'text-blue-500' : 'text-gray-500'}`}>
                            {modalFechado ? (
                              <>
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                Fechado pelo usuário
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-5 w-5 mr-2" />
                                Não fechado
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h4 className="font-medium mb-2">Funções de teste</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            onClick={forcarAcessoRoletas}
                            className="flex items-center"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Forçar acesso à API
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            onClick={limparStatusModal}
                            className="flex items-center"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Resetar status do modal
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            onClick={limparStatusPolling}
                            className="flex items-center"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Resetar status do polling
                          </Button>
                          
                          <Button 
                            variant={pollingPausado ? "default" : "outline"} 
                            onClick={retomarPolling}
                            disabled={!pollingPausado}
                            className="flex items-center"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Retomar polling
                          </Button>
                        </div>
                      </div>
                      
                      <Alert>
                        <AlertTitle>Como testar o modal</AlertTitle>
                        <AlertDescription>
                          <ol className="list-decimal pl-5 space-y-1 mt-2">
                            <li>Use "Resetar status do modal" e "Resetar status do polling" para limpar os estados</li>
                            <li>Clique em "Forçar acesso à API" para tentar uma requisição (deve mostrar o modal)</li>
                            <li>Feche o modal e observe que o polling foi pausado</li>
                            <li>Clique novamente em "Forçar acesso à API" (não deve mostrar o modal novamente)</li>
                            <li>Use o botão "Retomar polling" ou o indicador flutuante para reativar</li>
                          </ol>
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TestStep>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestFluxoCompleto; 