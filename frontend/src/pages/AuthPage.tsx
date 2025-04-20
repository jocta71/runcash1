import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, LockIcon, MailIcon, UserIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import axios from 'axios';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('login');
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // API URL
  const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';

  useEffect(() => {
    // Verificar se auth Google está disponível
    const checkAuthStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/google/status`);
        setIsGoogleAuthEnabled(response.data.enabled);
      } catch (error) {
        console.error('Erro ao verificar status da autenticação:', error);
        setIsGoogleAuthEnabled(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuthStatus();
    
    // Redirect to home if already logged in
    if (user) {
      navigate('/');
    }
    
    // Verificar se há erro no URL (redirecionado do Google Auth)
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error === 'google_auth_disabled') {
      toast({
        title: "Autenticação Google desativada",
        description: "Essa funcionalidade não está configurada no servidor.",
        variant: "destructive"
      });
    }
  }, [user, navigate, toast, API_URL]);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !validateEmail(email)) {
      setErrorMessage('Por favor, forneça um email válido.');
      return;
    }
    
    if (!password || password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMessage(error.message || 'Erro ao fazer login. Tente novamente.');
      } else {
        toast({
          title: "Login bem-sucedido",
          description: "Bem-vindo de volta!",
        });
        navigate('/');
      }
    } catch (err) {
      setErrorMessage('Ocorreu um erro inesperado. Tente novamente mais tarde.');
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || username.length < 3) {
      setErrorMessage('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }
    
    if (!email || !validateEmail(email)) {
      setErrorMessage('Por favor, forneça um email válido.');
      return;
    }
    
    if (!password || password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const { error } = await signUp(username, email, password);
      if (error) {
        setErrorMessage(error.message || 'Erro ao criar conta. Tente novamente.');
      } else {
        toast({
          title: "Conta criada com sucesso",
          description: "Você já pode usar sua conta para acessar o sistema.",
        });
        navigate('/');
      }
    } catch (err) {
      setErrorMessage('Ocorreu um erro inesperado. Tente novamente mais tarde.');
      console.error("Signup error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Validar formato de email
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleGoogleLogin = () => {
    if (isGoogleAuthEnabled) {
      console.log('Redirecionando para autenticação Google:', `${API_URL}/auth/google`);
      
      // Antes de redirecionar, mostrar loading state
      setIsLoading(true);
      
      // Armazenar a informação que o login via Google foi iniciado
      localStorage.setItem('googleAuthInProgress', 'true');
      
      // Redirecionar para a URL de autenticação Google
      window.location.href = `${API_URL}/auth/google`;
    } else {
      toast({
        title: "Login com Google desativado",
        description: "Esta funcionalidade não está disponível no momento.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Site real como fundo */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-gray-900 to-gray-950">
        {/* Cabeçalho do site real */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <img src="/img/logo.svg" alt="RunCash Logo" className="h-10" />
            <span className="text-xl font-bold text-white">RunCash</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-vegas-green/20 flex items-center justify-center text-vegas-green font-bold">U</div>
            <div className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-800">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
          </div>
        </header>
        
        {/* Linha verde */}
        <div className="h-1 w-full bg-vegas-green"></div>
        
        {/* Layout principal do site real */}
        <div className="flex h-[calc(100vh-4.25rem)]">
          {/* Sidebar com navegação real */}
          <div className="w-64 p-3">
            <div className="bg-gray-900 h-full rounded-lg border border-gray-800 p-4">
              <div className="flex flex-col gap-3">
                <div className="h-10 px-3 bg-vegas-green/10 border border-vegas-green/20 rounded-md flex items-center gap-2 text-sm text-vegas-green font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  Dashboard
                </div>
                <div className="h-10 px-3 bg-gray-800/50 rounded-md flex items-center gap-2 text-sm text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Histórico
                </div>
                <div className="h-10 px-3 bg-gray-800/50 rounded-md flex items-center gap-2 text-sm text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  Configurações
                </div>
              </div>
              
              {/* Estatísticas do usuário - versão real mas bloqueada */}
              <div className="mt-6 relative">
                <div className="bg-gray-800/80 rounded-lg p-4">
                  <h3 className="text-vegas-green font-medium text-sm mb-4">Estatísticas do Usuário</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Jogos Totais</span>
                        <span className="text-white">1,234</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-vegas-green w-3/4 rounded-full"></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Taxa de Vitória</span>
                        <span className="text-white">68%</span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-vegas-green w-2/3 rounded-full"></div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="bg-gray-800 p-2 rounded-md">
                        <div className="text-xs text-gray-400">Ganhos</div>
                        <div className="text-green-400 font-medium">+R$ 2.450</div>
                      </div>
                      <div className="bg-gray-800 p-2 rounded-md">
                        <div className="text-xs text-gray-400">Perdas</div>
                        <div className="text-red-400 font-medium">-R$ 1.120</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Sobreposição de bloqueio */}
                <div className="absolute inset-0 bg-gray-900/75 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
                  <LockIcon className="h-10 w-10 text-vegas-green/40 mb-2" />
                  <span className="text-sm text-gray-400">Faça login para ver estatísticas</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Área principal - com roletas que parecem reais */}
          <div className="flex-1 p-3">
            <div className="bg-gray-900 h-full rounded-lg border border-gray-800 p-4 relative overflow-auto">
              {/* Cabeçalho com filtros */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-4">
                  <h2 className="text-white font-medium">Roletas Disponíveis</h2>
                  <div className="h-8 px-3 bg-gray-800 rounded-md flex items-center gap-1 text-sm text-gray-400">
                    <span>Filtrar</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                    </svg>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-36 bg-vegas-green/20 rounded-md flex items-center justify-center text-vegas-green text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Atualizar Dados
                  </div>
                </div>
              </div>
              
              {/* Roletas que parecem reais */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {/* Roleta 1 */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 relative overflow-hidden">
                  <div className="flex justify-between items-center p-3 border-b border-gray-700">
                    <h3 className="text-white font-medium">Roleta Europeia</h3>
                    <div className="bg-green-600/20 text-green-400 text-xs px-2 py-1 rounded-full">
                      Online
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex space-x-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">1</div>
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">20</div>
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">15</div>
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">8</div>
                    </div>
                    <div className="bg-gray-700 p-2 rounded-md">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Último giro:</span>
                        <span className="text-white">Números ímpares</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">RTP Atual:</span>
                        <span className="text-green-400">97.4%</span>
                      </div>
                    </div>
                  </div>
                  {/* Sobreposição de bloqueio */}
                  <div className="absolute inset-0 bg-gray-900/75 backdrop-blur-sm flex flex-col items-center justify-center">
                    <LockIcon className="h-10 w-10 text-vegas-green/40 mb-2" />
                    <span className="text-sm text-gray-400">Faça login para acessar</span>
                  </div>
                </div>
                
                {/* Roleta 2 */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 relative overflow-hidden">
                  <div className="flex justify-between items-center p-3 border-b border-gray-700">
                    <h3 className="text-white font-medium">Roleta Americana</h3>
                    <div className="bg-green-600/20 text-green-400 text-xs px-2 py-1 rounded-full">
                      Online
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex space-x-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">26</div>
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">10</div>
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">3</div>
                      <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold">0</div>
                    </div>
                    <div className="bg-gray-700 p-2 rounded-md">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Último giro:</span>
                        <span className="text-white">Zero</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">RTP Atual:</span>
                        <span className="text-yellow-400">94.8%</span>
                      </div>
                    </div>
                  </div>
                  {/* Sobreposição de bloqueio */}
                  <div className="absolute inset-0 bg-gray-900/75 backdrop-blur-sm flex flex-col items-center justify-center">
                    <LockIcon className="h-10 w-10 text-vegas-green/40 mb-2" />
                    <span className="text-sm text-gray-400">Faça login para acessar</span>
                  </div>
                </div>
                
                {/* Roleta 3 */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 relative overflow-hidden">
                  <div className="flex justify-between items-center p-3 border-b border-gray-700">
                    <h3 className="text-white font-medium">Lightning Roleta</h3>
                    <div className="bg-red-600/20 text-red-400 text-xs px-2 py-1 rounded-full">
                      Offline
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex space-x-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">36</div>
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">11</div>
                      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">19</div>
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">22</div>
                    </div>
                    <div className="bg-gray-700 p-2 rounded-md">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Último giro:</span>
                        <span className="text-white">Vermelho</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">RTP Atual:</span>
                        <span className="text-red-400">92.6%</span>
                      </div>
                    </div>
                  </div>
                  {/* Sobreposição de bloqueio */}
                  <div className="absolute inset-0 bg-gray-900/75 backdrop-blur-sm flex flex-col items-center justify-center">
                    <LockIcon className="h-10 w-10 text-vegas-green/40 mb-2" />
                    <span className="text-sm text-gray-400">Faça login para acessar</span>
                  </div>
                </div>
                
                {/* Mais roletas... */}
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="bg-gray-800 rounded-lg border border-gray-700 relative overflow-hidden">
                    <div className="flex justify-between items-center p-3 border-b border-gray-700">
                      <h3 className="text-white font-medium">{`Roleta ${index + 4}`}</h3>
                      <div className="bg-green-600/20 text-green-400 text-xs px-2 py-1 rounded-full">
                        Online
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex space-x-2 mb-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className={`w-8 h-8 rounded-full ${Math.random() > 0.5 ? 'bg-red-500' : 'bg-black'} flex items-center justify-center text-white text-xs font-bold`}>
                            {Math.floor(Math.random() * 36) + 1}
                          </div>
                        ))}
                      </div>
                      <div className="bg-gray-700 p-2 rounded-md">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Último giro:</span>
                          <span className="text-white">{Math.random() > 0.5 ? 'Vermelho' : 'Preto'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">RTP Atual:</span>
                          <span className={`${Math.random() > 0.7 ? 'text-green-400' : Math.random() > 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {(90 + Math.random() * 9).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Sobreposição de bloqueio */}
                    <div className="absolute inset-0 bg-gray-900/75 backdrop-blur-sm flex flex-col items-center justify-center">
                      <LockIcon className="h-10 w-10 text-vegas-green/40 mb-2" />
                      <span className="text-sm text-gray-400">Faça login para acessar</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de autenticação flutuando sobre o site real */}
      <div className="relative min-h-screen w-full flex items-center justify-center p-4 z-10">
        <div className="bg-gray-900/90 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 border border-gray-800">
          {/* Lado esquerdo - Imagem */}
          <div className="relative hidden md:block">
            <div 
              className="absolute inset-0 bg-cover bg-center" 
              style={{ backgroundImage: "url('/login-imagem.png')" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/70 flex flex-col justify-between p-8">
              <div>
                <h2 className="text-white text-3xl font-bold drop-shadow-md">RunCash</h2>
                <p className="text-gray-200 mt-2 drop-shadow-md max-w-xs">A maneira mais inteligente de acompanhar seus resultados</p>
              </div>
              <div className="bg-black/30 p-4 rounded-lg backdrop-blur-sm">
                <blockquote className="italic text-white drop-shadow-md text-sm">
                  "Esta plataforma revolucionou a maneira como eu analiso meus resultados e aumentou meus ganhos significativamente."
                </blockquote>
                <p className="text-gray-200 mt-2 font-semibold drop-shadow-md text-sm">João Silva</p>
              </div>
            </div>
          </div>

          {/* Lado direito - Formulário */}
          <div className="p-6 md:p-8 bg-gray-900/95 backdrop-blur-md">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
                <TabsTrigger value="login" className="data-[state=active]:bg-vegas-green data-[state=active]:text-gray-900">
                  Login
                </TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-vegas-green data-[state=active]:text-gray-900">
                  Cadastro
                </TabsTrigger>
              </TabsList>
              
              {/* Conteúdo da aba de Login */}
              <TabsContent value="login" className="space-y-4 mt-4">
                <div className="flex flex-col space-y-2 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-white">Entre na sua conta</h1>
                  <p className="text-sm text-gray-400">Digite suas credenciais para acessar</p>
                </div>

                {errorMessage && activeTab === 'login' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="nome@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-white">Senha</Label>
                      <a href="#" className="text-xs text-vegas-green hover:underline">
                        Esqueceu a senha?
                      </a>
                    </div>
                    <div className="relative">
                      <LockIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-vegas-green hover:bg-vegas-green/90 text-gray-900 font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-gray-950 px-2 text-gray-400">Ou continue com</span>
                    </div>
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full border-gray-700 bg-gray-900/50 text-white hover:bg-gray-800"
                    disabled={isCheckingAuth || isLoading || !isGoogleAuthEnabled}
                    onClick={handleGoogleLogin}
                  >
                    {isCheckingAuth ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-2"
                      >
                        <path
                          fill="#EA4335"
                          d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"
                        />
                        <path
                          fill="#34A853"
                          d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2970142 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"
                        />
                        <path
                          fill="#4A90E2"
                          d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5818182 23.1272727,9.90909091 L12,9.90909091 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"
                        />
                      </svg>
                    )}
                    Continuar com Google
                  </Button>
                  {!isGoogleAuthEnabled && !isCheckingAuth && (
                    <div className="text-center text-xs text-red-400 mt-2">
                      Login com Google está desativado no momento
                    </div>
                  )}
                </form>
              </TabsContent>
              
              {/* Conteúdo da aba de Cadastro */}
              <TabsContent value="register" className="space-y-4 mt-4">
                <div className="flex flex-col space-y-2 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-white">Criar uma conta</h1>
                  <p className="text-sm text-gray-400">Preencha seus dados para se cadastrar</p>
                </div>

                {errorMessage && activeTab === 'register' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username" className="text-white">Nome de Usuário</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="seunome"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="register-email" className="text-white">Email</Label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="register-password" className="text-white">Senha</Label>
                    <div className="relative">
                      <LockIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password" className="text-white">Confirmar Senha</Label>
                    <div className="relative">
                      <LockIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-vegas-green hover:bg-vegas-green/90 text-gray-900 font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Criar Conta'}
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-gray-950 px-2 text-gray-400">Ou inscreva-se com</span>
                    </div>
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full border-gray-700 bg-gray-900/50 text-white hover:bg-gray-800"
                    disabled={isCheckingAuth || isLoading || !isGoogleAuthEnabled}
                    onClick={handleGoogleLogin}
                  >
                    {isCheckingAuth ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-2"
                      >
                        <path
                          fill="#EA4335"
                          d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"
                        />
                        <path
                          fill="#34A853"
                          d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2970142 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"
                        />
                        <path
                          fill="#4A90E2"
                          d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5818182 23.1272727,9.90909091 L12,9.90909091 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7301709 1.23746264,17.3349879 L5.27698177,14.2678769 Z"
                        />
                      </svg>
                    )}
                    Google
                  </Button>
                  {!isGoogleAuthEnabled && !isCheckingAuth && (
                    <div className="text-center text-xs text-red-400 mt-2">
                      Login com Google está desativado no momento
                    </div>
                  )}
                </form>
              </TabsContent>
            </Tabs>
            
            <p className="text-center text-xs text-gray-400 mt-6">
              Ao clicar em continuar, você concorda com nossos{' '}
              <a href="#" className="text-vegas-green hover:underline">
                Termos
              </a>{' '}
              e{' '}
              <a href="#" className="text-vegas-green hover:underline">
                Privacidade
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
