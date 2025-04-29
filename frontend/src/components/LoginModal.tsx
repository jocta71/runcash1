import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, LockIcon, MailIcon, UserIcon, CreditCard } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectAfterLogin?: string;
  message?: string;
  requiresSubscription?: boolean;
}

const LoginModal = ({ isOpen, onClose, redirectAfterLogin, message, requiresSubscription = false }: LoginModalProps) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(message || '');
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('login');
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  
  // API URL
  const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';

  // Verificar se auth Google está disponível
  useEffect(() => {
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
  }, [API_URL]);

  // Atualizar mensagem de erro quando ela for passada como prop
  useEffect(() => {
    if (message) {
      setErrorMessage(message);
    }
  }, [message]);

  // Definir a aba ativa com base na necessidade de assinatura
  useEffect(() => {
    if (requiresSubscription && user) {
      // Se requer assinatura e o usuário já está logado, mostrar a aba de assinatura
      setActiveTab('subscription');
    } else {
      // Caso contrário, mostrar a aba de login
      setActiveTab('login');
    }
  }, [requiresSubscription, user]);

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
      console.log('[LoginModal] Iniciando processo de login');
      const { error } = await signIn(email, password);
      
      if (error) {
        setErrorMessage(error.message || 'Erro ao fazer login. Tente novamente.');
      } else {
        // Garantir que o token seja persistido antes de continuar
        console.log('[LoginModal] Login bem-sucedido, persistindo sessão');
        
        toast({
          title: "Login bem-sucedido",
          description: "Bem-vindo de volta!",
        });
        
        // Se requer assinatura, mudar para a aba de assinatura ao invés de fechar o modal
        if (requiresSubscription) {
          setActiveTab('subscription');
          setIsLoading(false);
          return;
        }
        
        // Atraso para garantir que os cookies sejam definidos
        // O setTimeout também evita problemas com redirecionamentos muito rápidos
        setTimeout(() => {
          // Primeiro fechar o modal
          onClose();
          
          // Se houver uma URL de redirecionamento, navegar para lá
          if (redirectAfterLogin) {
            console.log(`[LoginModal] Redirecionando para: ${redirectAfterLogin}`);
            
            // Atraso adicional para redirecionamento
            setTimeout(() => {
              // Usar navigate com state para indicar que é um redirecionamento pós-login
              navigate(redirectAfterLogin, {
                state: { fromLogin: true, timestamp: Date.now() }
              });
            }, 300);
          }
        }, 800);
      }
    } catch (err) {
      console.error('[LoginModal] Erro durante login:', err);
      setErrorMessage('Ocorreu um erro inesperado. Tente novamente mais tarde.');
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
      console.log('[LoginModal] Iniciando processo de cadastro');
      const { error } = await signUp(username, email, password);
      
      if (error) {
        setErrorMessage(error.message || 'Erro ao criar conta. Tente novamente.');
      } else {
        console.log('[LoginModal] Cadastro bem-sucedido, persistindo sessão');
        
        toast({
          title: "Conta criada com sucesso",
          description: "Você já pode usar sua conta para acessar o sistema.",
        });
        
        // Se requer assinatura, mudar para a aba de assinatura ao invés de fechar o modal
        if (requiresSubscription) {
          setActiveTab('subscription');
          setIsLoading(false);
          return;
        }
        
        // Atraso para garantir que os cookies sejam definidos
        setTimeout(() => {
          // Primeiro fechar o modal
          onClose();
          
          // Se houver uma URL de redirecionamento, navegar para lá após cadastro bem-sucedido
          if (redirectAfterLogin) {
            console.log(`[LoginModal] Redirecionando para: ${redirectAfterLogin}`);
            
            // Atraso adicional para redirecionamento
            setTimeout(() => {
              // Usar navigate com state para indicar que é um redirecionamento pós-signup
              navigate(redirectAfterLogin, {
                state: { fromSignup: true, timestamp: Date.now() }
              });
            }, 300);
          }
        }, 800);
      }
    } catch (err) {
      console.error('[LoginModal] Erro durante cadastro:', err);
      setErrorMessage('Ocorreu um erro inesperado. Tente novamente mais tarde.');
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
      
      // Armazenar o redirecionamento, se existir
      if (redirectAfterLogin) {
        localStorage.setItem('redirectAfterGoogleLogin', redirectAfterLogin);
      }
      
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

  // Navegar para página de assinatura
  const handleNavigateToSubscription = () => {
    // Fechar o modal
    onClose();
    
    // Navegar para a página de assinaturas
    navigate('/subscription', {
      state: { 
        fromLoginModal: true, 
        timestamp: Date.now(),
        returnTo: redirectAfterLogin
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl grid grid-cols-1 md:grid-cols-2 p-0 gap-0 overflow-hidden">
        {/* Lado esquerdo - Imagem */}
        <div className="relative hidden md:block">
          <div 
            className="absolute inset-0 bg-cover bg-center" 
            style={{ backgroundImage: "url('/img/login-imagem.png')" }}
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
        <div className="p-6 md:p-8 bg-gray-900">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-vegas-green data-[state=active]:text-gray-900">
                Login
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-vegas-green data-[state=active]:text-gray-900">
                Cadastro
              </TabsTrigger>
              {/* Aba oculta para assinatura */}
              {requiresSubscription && (
                <TabsTrigger value="subscription" className="hidden">
                  Assinatura
                </TabsTrigger>
              )}
            </TabsList>

            {/* Conteúdo da Aba de Login */}
            <TabsContent value="login" className="mt-6">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Bem-vindo de volta</h2>
                <p className="text-gray-400">Acesse sua conta para continuar</p>
                
                {errorMessage && (
                  <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleManualLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-200">Email</Label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        type="email"
                        id="email"
                        placeholder="seu@email.com"
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-200">Senha</Label>
                    <div className="relative">
                      <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        type="password"
                        id="password"
                        placeholder="••••••••"
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-vegas-green text-gray-900 hover:bg-vegas-green/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : "Entrar"}
                  </Button>
                </form>

                {isGoogleAuthEnabled && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-gray-900 px-2 text-gray-400">ou continue com</span>
                      </div>
                    </div>

                    <Button 
                      type="button" 
                      className="w-full border border-gray-700 text-white hover:bg-gray-800"
                      onClick={handleGoogleLogin}
                      disabled={isLoading || isCheckingAuth}
                    >
                      {isCheckingAuth ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="h-5 w-5 mr-2" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C6.421 2 1.545 6.876 1.545 13s4.876 11 11 11c6.139 0 10.393-4.007 10.393-10.993 0-.695-.092-1.452-.228-2.104l-9.165.335z" />
                        </svg>
                      )}
                      Google
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Conteúdo da Aba de Cadastro */}
            <TabsContent value="register" className="mt-6">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">Criar uma conta</h2>
                <p className="text-gray-400">Preencha os dados para começar</p>
                
                {errorMessage && (
                  <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-gray-200">Nome de usuário</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        type="text"
                        id="username"
                        placeholder="seu_username"
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-gray-200">Email</Label>
                    <div className="relative">
                      <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        type="email"
                        id="signup-email"
                        placeholder="seu@email.com"
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-gray-200">Senha</Label>
                    <div className="relative">
                      <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        type="password"
                        id="signup-password"
                        placeholder="••••••••"
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-gray-200">Confirmar Senha</Label>
                    <div className="relative">
                      <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        type="password"
                        id="confirm-password"
                        placeholder="••••••••"
                        className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-vegas-green text-gray-900 hover:bg-vegas-green/90"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : "Criar Conta"}
                  </Button>
                </form>

                {isGoogleAuthEnabled && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-gray-900 px-2 text-gray-400">ou continue com</span>
                      </div>
                    </div>

                    <Button 
                      type="button" 
                      className="w-full border border-gray-700 text-white hover:bg-gray-800"
                      onClick={handleGoogleLogin}
                      disabled={isLoading || isCheckingAuth}
                    >
                      {isCheckingAuth ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="h-5 w-5 mr-2" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C6.421 2 1.545 6.876 1.545 13s4.876 11 11 11c6.139 0 10.393-4.007 10.393-10.993 0-.695-.092-1.452-.228-2.104l-9.165.335z" />
                        </svg>
                      )}
                      Google
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
            
            {/* Conteúdo da Aba de Assinatura */}
            {requiresSubscription && (
              <TabsContent value="subscription" className="mt-6">
                <div className="space-y-6">
                  <div className="text-center">
                    <CreditCard className="mx-auto h-12 w-12 text-vegas-green" />
                    <h2 className="mt-4 text-2xl font-bold text-white">Assinatura necessária</h2>
                    <p className="mt-2 text-gray-400">Para acessar este conteúdo, você precisa de uma assinatura ativa.</p>
                  </div>
                  
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white">Benefícios da assinatura:</h3>
                    <ul className="mt-2 space-y-2 text-gray-300">
                      <li className="flex items-start">
                        <svg className="h-5 w-5 mr-2 text-vegas-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Acesso a todos os dados em tempo real
                      </li>
                      <li className="flex items-start">
                        <svg className="h-5 w-5 mr-2 text-vegas-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Análises avançadas e insights
                      </li>
                      <li className="flex items-start">
                        <svg className="h-5 w-5 mr-2 text-vegas-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Alertas e notificações personalizadas
                      </li>
                      <li className="flex items-start">
                        <svg className="h-5 w-5 mr-2 text-vegas-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Suporte prioritário
                      </li>
                    </ul>
                  </div>
                  
                  <Button 
                    onClick={handleNavigateToSubscription}
                    className="w-full bg-vegas-green text-gray-900 hover:bg-vegas-green/90"
                  >
                    Ver planos de assinatura
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal; 