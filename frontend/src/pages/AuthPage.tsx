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
      <div className="bg-gray-900 py-12 md:py-24 hidden md:flex flex-col justify-between h-full">
        <div className="px-12">
          <div className="flex items-center gap-2">
            <img src="/img/logo.svg" alt="RunCash Logo" className="h-10" />
            <span className="text-xl font-bold text-white">RunCash</span>
          </div>
        </div>
        <div className="px-12 pb-12">
          <blockquote className="space-y-2">
            <p className="text-lg text-white">
              "Esta plataforma tem economizado inúmeras horas de trabalho e me ajudado a entregar resultados incríveis para meus clientes."
            </p>
            <footer className="text-sm text-gray-400">
              Sofia Silva
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Lado direito - Formulário de autenticação */}
      <div className="flex items-center justify-center px-8 py-12 md:px-12 lg:px-16 md:py-24 bg-gray-950">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Criar uma conta
            </h1>
            <p className="text-sm text-gray-400">
              Digite seu email abaixo para criar sua conta
            </p>
          </div>

          <div className="grid gap-6">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            <Input
              id="email"
              type="email"
              placeholder="nome@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-900/50 border-gray-700 text-white"
              required
            />
            
            <Button 
              className="w-full bg-vegas-green hover:bg-vegas-green/90 text-gray-900 font-medium"
              onClick={handleEmailSignIn}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar com Email'}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-700"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-950 px-2 text-gray-400">
                  Ou continue com
                </span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full border-gray-700 bg-gray-900/50 text-white hover:bg-gray-800"
              onClick={handleGithubLogin}
              disabled={isCheckingAuth || isLoading}
            >
              {isCheckingAuth ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 438.549 438.549" className="mr-2 h-4 w-4">
                  <path
                    fill="currentColor"
                    d="M409.132 114.573c-19.608-33.596-46.205-60.194-79.798-79.8-33.598-19.607-70.277-29.408-110.063-29.408-39.781 0-76.472 9.804-110.063 29.408-33.596 19.605-60.192 46.204-79.8 79.8C9.803 148.168 0 184.854 0 224.63c0 47.78 13.94 90.745 41.827 128.906 27.884 38.164 63.906 64.572 108.063 79.227 5.14.954 8.945.283 11.419-1.996 2.475-2.282 3.711-5.14 3.711-8.562 0-.571-.049-5.708-.144-15.417a2549.81 2549.81 0 01-.144-25.406l-6.567 1.136c-4.187.767-9.469 1.092-15.846 1-6.374-.089-12.991-.757-19.842-1.999-6.854-1.231-13.229-4.086-19.13-8.559-5.898-4.473-10.085-10.328-12.56-17.556l-2.855-6.57c-1.903-4.374-4.899-9.233-8.992-14.559-4.093-5.331-8.232-8.945-12.419-10.848l-1.999-1.431c-1.332-.951-2.568-2.098-3.711-3.429-1.142-1.331-1.997-2.663-2.568-3.997-.572-1.335-.098-2.43 1.427-3.289 1.525-.859 4.281-1.276 8.28-1.276l5.708.853c3.807.763 8.516 3.042 14.133 6.851 5.614 3.806 10.229 8.754 13.846 14.842 4.38 7.806 9.657 13.754 15.846 17.847 6.184 4.093 12.419 6.136 18.699 6.136 6.28 0 11.704-.476 16.274-1.423 4.565-.952 8.848-2.383 12.847-4.285 1.713-12.758 6.377-22.559 13.988-29.41-10.848-1.14-20.601-2.857-29.264-5.14-8.658-2.286-17.605-5.996-26.835-11.14-9.235-5.137-16.896-11.516-22.985-19.126-6.09-7.614-11.088-17.61-14.987-29.979-3.901-12.374-5.852-26.648-5.852-42.826 0-23.035 7.52-42.637 22.557-58.817-7.044-17.318-6.379-36.732 1.997-58.24 5.52-1.715 13.706-.428 24.554 3.853 10.85 4.283 18.794 7.952 23.84 10.994 5.046 3.041 9.089 5.618 12.135 7.708 17.705-4.947 35.976-7.421 54.818-7.421s37.117 2.474 54.823 7.421l10.849-6.849c7.419-4.57 16.18-8.758 26.262-12.565 10.088-3.805 17.802-4.853 23.134-3.138 8.562 21.509 9.325 40.922 2.279 58.24 15.036 16.18 22.559 35.787 22.559 58.817 0 16.178-1.958 30.497-5.853 42.966-3.9 12.471-8.941 22.457-15.125 29.979-6.191 7.521-13.901 13.85-23.131 18.986-9.232 5.14-18.182 8.85-26.84 11.136-8.662 2.286-18.415 4.004-29.263 5.146 9.894 8.562 14.842 22.077 14.842 40.539v60.237c0 3.422 1.19 6.279 3.572 8.562 2.379 2.279 6.136 2.95 11.276 1.995 44.163-14.653 80.185-41.062 108.068-79.226 27.88-38.161 41.825-81.126 41.825-128.906-.01-39.771-9.818-76.454-29.414-110.049z"
                  ></path>
                </svg>
              )}
              GitHub
            </Button>
          </div>
          
          <p className="px-8 text-center text-sm text-gray-400">
            Ao clicar em continuar, você concorda com nossos{' '}
            <a href="#" className="underline underline-offset-4 hover:text-vegas-green">
              Termos de Serviço
            </a>{' '}
            e{' '}
            <a href="#" className="underline underline-offset-4 hover:text-vegas-green">
              Política de Privacidade
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
