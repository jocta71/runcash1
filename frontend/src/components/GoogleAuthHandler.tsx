import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';
import Cookies from 'js-cookie';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';
/**
 * Componente que lida com a autenticação via Google
 * Verifica se há um token na URL e processa a autenticação
 */
const GoogleAuthHandler = () => {
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const handlerExecuted = useRef(false);

  useEffect(() => {
    // Evitar execuções duplicadas
    if (handlerExecuted.current) return;
    
    const handleGoogleAuth = async () => {
      handlerExecuted.current = true;
      
      // Verificar se há um token do Google Auth na URL
      const urlParams = new URLSearchParams(window.location.search);
      const googleToken = urlParams.get('google_token');
      
      // Verificar se o login via Google foi iniciado
      const googleAuthInProgress = localStorage.getItem('googleAuthInProgress');
      
      // Se não há token nem processo em andamento, não fazer nada
      if (!googleToken && googleAuthInProgress !== 'true') return;
      
      // Se houver um token na URL, processar a autenticação
      if (googleToken) {
        try {
          // Configurar cookie com opções adequadas ao ambiente
          const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          const cookieOptions = {
            secure: isLocalhost ? false : window.location.protocol === "https:",
            sameSite: isLocalhost ? 'lax' as const : 'none' as const,
            path: '/',
            expires: 30
          };
          
          // Salvar o token no cookie
          Cookies.set('token', googleToken, cookieOptions);
          
          // Salvar no localStorage como backup
          localStorage.setItem('auth_token_backup', googleToken);
          
          // Atualizar o estado de autenticação
          setToken(googleToken);
          
          // Buscar informações do usuário
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${googleToken}`
            }
          });
          
          if (response.data.success && response.data.data) {
            // Atualizar o estado do usuário
            setUser(response.data.data);
            
            // Limpar o token da URL para evitar exposição
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Limpar a flag que indica login Google em progresso
            localStorage.removeItem('googleAuthInProgress');
            
            // Mostrar toast de sucesso
            toast({
              title: 'Login com Google concluído',
              description: 'Você foi autenticado com sucesso via Google',
            });
            
            // Redirecionar para a página inicial
            navigate('/');
          }
        } catch (error) {
          // Limpar a flag que indica login Google em progresso
          localStorage.removeItem('googleAuthInProgress');
          
          toast({
            title: 'Erro na autenticação',
            description: 'Ocorreu um erro ao processar sua autenticação com Google',
            variant: 'destructive'
          });
          
          // Redirecionar para o login em caso de erro
          navigate('/login');
        }
      }
      // Se o login via Google foi iniciado mas não há token na URL
      else if (googleAuthInProgress === 'true') {
        // Limpar a flag
        localStorage.removeItem('googleAuthInProgress');
        
        // Mostrar mensagem de erro
        toast({
          title: 'Autenticação Google não concluída',
          description: 'O processo de login com Google foi interrompido',
          variant: 'destructive'
        });
      }
    };
    
    // Executar com um pequeno delay para não bloquear a renderização inicial
    const timer = setTimeout(() => {
      handleGoogleAuth();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [navigate, setToken, setUser, toast]);
  
  // Este componente não renderiza nada visualmente
  return null;
};

export default GoogleAuthHandler; 