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
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

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

  // Hooks
  const navigate = useNavigate();
  const { user, signIn: login, signUp: register } = useAuth();
  const { toast } = useToast();
  const { currentSubscription, loadUserSubscription } = useSubscription();

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
    
    try {
      const response = await axios.post(`${API_URL}/api/asaas-create-subscription`, {
        planId: selectedPlan,
        userId: user?.id,
        customerId: user?.asaasCustomerId,
        billingType: 'PIX'
      });
      
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
        throw new Error('URL de checkout não recebida');
      }
    } catch (error: any) {
      setPagamentoStatus('error');
      setPagamentoError(error.message || 'Erro ao criar checkout');
      toast({
        variant: "destructive",
        title: "Erro no checkout",
        description: error.message || 'Ocorreu um erro ao tentar criar o checkout.',
      });
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

  return (
    <div className="container mx-auto py-8">
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

              {!checkoutUrl ? (
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
                  ) : 'Gerar Checkout'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertTitle>Checkout gerado com sucesso!</AlertTitle>
                    <AlertDescription className="mt-2">
                      <p className="mb-2">Para fins deste teste, o pagamento será simulado automaticamente em 5 segundos.</p>
                      <p className="text-sm text-gray-500">URL de checkout gerada: <span className="font-mono text-xs">{checkoutUrl}</span></p>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex items-center justify-center p-4 bg-gray-50 rounded-md">
                    <Loader2 className="animate-spin mr-2" />
                    <span>Simulando pagamento via PIX...</span>
                  </div>
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
            </div>
          </TestStep>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestFluxoCompleto; 