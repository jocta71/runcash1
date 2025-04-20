import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);
  const [isGithubAuthEnabled, setIsGithubAuthEnabled] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // API URL
  const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';

  useEffect(() => {
    // Verificar se auth Google e GitHub estão disponíveis
    const checkAuthStatus = async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/google/status`);
        setIsGoogleAuthEnabled(response.data.enabled);
        
        // Simule verificação para GitHub (ajuste conforme necessário)
        setIsGithubAuthEnabled(false);
      } catch (error) {
        console.error('Erro ao verificar status da autenticação:', error);
        setIsGoogleAuthEnabled(false);
        setIsGithubAuthEnabled(false);
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

  const handleEmailSignIn = () => {
    if (!email || !validateEmail(email)) {
      setErrorMessage('Por favor, forneça um email válido.');
      return;
    }
    
    // Aqui você poderia implementar o envio de link por email
    // Por enquanto, vamos apenas mostrar um toast
    toast({
      title: "Link de acesso enviado",
      description: "Verifique seu email para fazer login.",
    });
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

  const handleGithubLogin = () => {
    toast({
      title: "Login com GitHub desativado",
      description: "Esta funcionalidade não está disponível no momento.",
      variant: "destructive"
    });
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
            <h1 className="text-2xl font-semibold tracking-tight text-white">Criar uma conta</h1>
            <p className="text-sm text-gray-400">Digite seu email abaixo para criar sua conta</p>
          </div>

          <div className="flex flex-col space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid gap-2">
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white"
                required
              />
            </div>
            
            <Button 
              type="button" 
              className="w-full bg-vegas-green hover:bg-vegas-green/90 text-gray-900 font-medium"
              onClick={handleEmailSignIn}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar com Email'}
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
              onClick={handleGithubLogin}
              disabled={isCheckingAuth || isLoading}
            >
              {isCheckingAuth ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5">
                  <path
                    fill="currentColor"
                    d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385c.6.105.825-.255.825-.57c0-.285-.015-1.23-.015-2.235c-3.015.555-3.795-.735-4.035-1.41c-.135-.345-.72-1.41-1.23-1.695c-.42-.225-1.02-.78-.015-.795c.945-.015 1.62.87 1.845 1.23c1.08 1.815 2.805 1.305 3.495.99c.105-.78.42-1.305.765-1.605c-2.67-.3-5.46-1.335-5.46-5.925c0-1.305.465-2.385 1.23-3.225c-.12-.3-.54-1.53.12-3.18c0 0 1.005-.315 3.3 1.23c.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23c.66 1.65.24 2.88.12 3.18c.765.84 1.23 1.905 1.23 3.225c0 4.605-2.805 5.625-5.475 5.925c.435.375.81 1.095.81 2.22c0 1.605-.015 2.895-.015 3.3c0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
                  />
                </svg>
              )}
              GitHub
            </Button>
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
            Já tem uma conta?{' '}
            <a href="/login" className="text-vegas-green hover:underline font-medium">
              Faça login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
