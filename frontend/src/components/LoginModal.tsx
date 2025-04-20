import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, LockIcon, MailIcon, UserIcon, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import axios from 'axios';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('login');
  const { signIn, signUp } = useAuth();
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
        onClose();
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
        onClose();
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl grid grid-cols-1 md:grid-cols-2 p-0 gap-0 overflow-hidden">
        {/* Botão de fechar */}
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50">
          <X className="h-5 w-5 text-white" />
          <span className="sr-only">Fechar</span>
        </DialogClose>

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
        <div className="p-6 md:p-8 bg-gray-900">
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
                    <span className="bg-gray-900 px-2 text-gray-400">Ou continue com</span>
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
                    <span className="bg-gray-900 px-2 text-gray-400">Ou inscreva-se com</span>
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
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal; 