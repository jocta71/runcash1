import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, LockIcon, MailIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import axios from 'axios';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('email');
  const { signIn, user } = useAuth();
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
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Lado esquerdo - Fundo escuro com logo e depoimento */}
      <div className="relative hidden flex-col justify-between bg-gray-900 p-10 text-white md:flex">
        <div>
          <div className="flex items-center gap-2">
            <img src="/img/logo.svg" alt="RunCash Logo" className="h-10" />
            <span className="text-xl font-bold">RunCash</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-lg">"Esta plataforma tem economizado inúmeras horas de trabalho e me ajudado a entregar resultados incríveis para meus clientes."</p>
          <div className="text-sm">Sofia Silva</div>
        </div>
      </div>

      {/* Lado direito - Formulário de autenticação */}
      <div className="flex items-center justify-center bg-gray-950 p-4 md:p-10">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Entre na sua conta</h1>
            <p className="text-sm text-gray-400">Escolha como deseja fazer login</p>
          </div>

          <div className="flex flex-col space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-900/50">
                <TabsTrigger value="email" className="data-[state=active]:bg-vegas-green data-[state=active]:text-gray-900">
                  Email/Senha
                </TabsTrigger>
                <TabsTrigger value="google" className="data-[state=active]:bg-vegas-green data-[state=active]:text-gray-900">
                  Google
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="email" className="mt-4">
                <form onSubmit={handleManualLogin}>
                  <div className="flex flex-col space-y-4">
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
                  </div>
                </form>
              </TabsContent>
              
              <TabsContent value="google" className="mt-4">
                <div className="text-center text-sm text-gray-400 mb-4">
                  Faça login com sua conta Google de forma rápida e segura
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
              </TabsContent>
            </Tabs>
          </div>
          
          <p className="px-8 text-center text-sm text-gray-400">
            Ao clicar em continuar, você concorda com nossos{' '}
            <a href="#" className="text-vegas-green hover:underline">
              Termos de Serviço
            </a>{' '}
            e{' '}
            <a href="#" className="text-vegas-green hover:underline">
              Política de Privacidade
            </a>
            .
          </p>
          
          <div className="text-center text-sm text-gray-400">
            Não tem uma conta?{' '}
            <a href="/register" className="text-vegas-green hover:underline font-medium">
              Cadastre-se
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
