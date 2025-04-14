import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

// Definir o tipo global para a janela
declare global {
  interface Window {
    authContextInstance?: {
      checkAuth: () => Promise<boolean>;
    };
  }
}

interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (username: string, email: string, password: string) => Promise<{ error: any }>;
  signOut: () => void;
  checkAuth: () => Promise<boolean>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

// Cookie options
const COOKIE_OPTIONS = {
  secure: true, // Sempre usar HTTPS em produção
  sameSite: 'none' as const, // Necessário para cookies cross-domain 
  path: '/',         // Disponível em todo o site
  expires: 30,       // Expiração em 30 dias
  domain: window.location.hostname.includes('localhost') ? 'localhost' : undefined, // Especificar domínio correto
};

// Nome do cookie - deve corresponder ao nome esperado pelo backend
const TOKEN_COOKIE_NAME = 'token';

// Criar contexto com valor padrão
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  isAuthenticated: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: () => {},
  checkAuth: async () => false,
  setUser: () => {},
  setToken: () => {}
});

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';

/**
 * Provedor de autenticação que se comunica com a API
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(Cookies.get(TOKEN_COOKIE_NAME) || null);
  const [loading, setLoading] = useState(true);
  
  // Criar estado computado para isAuthenticated baseado na existência do user ou token
  const isAuthenticated = Boolean(user) || Boolean(token);

  // Configuração global do axios para envio de cookies
  useEffect(() => {
    // Configurar axios para sempre enviar credenciais (cookies)
    axios.defaults.withCredentials = true;
    
    console.log('Axios configurado para enviar cookies em todas requisições');
  }, []);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const checkAuthOnLoad = async () => {
      console.log('Verificando autenticação ao carregar a página');
      
      // Verificar se há um token do Google Auth na URL
      const urlParams = new URLSearchParams(window.location.search);
      const googleToken = urlParams.get('google_token');
      
      if (googleToken) {
        console.log('Token do Google encontrado na URL, salvando...');
        // Salvar o token e limpar a URL
        saveToken(googleToken);
        
        // Carregar os dados do usuário
        try {
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${googleToken}`
            }
          });
          
          if (response.data.success) {
            setUser(response.data.data);
            console.log('Dados do usuário carregados após login do Google');
            
            // Limpar o token da URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (error) {
          console.error('Erro ao carregar usuário após login do Google:', error);
        }
        
        setLoading(false);
        return true;
      }
      
      // Verificação normal de autenticação
      const storedToken = Cookies.get(TOKEN_COOKIE_NAME);
      
      if (storedToken) {
        try {
          console.log('Token encontrado, verificando autenticação...');
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`
            }
          });
          
          if (response.data.success) {
            setUser(response.data.data);
            setToken(storedToken);
            console.log('Autenticação verificada com sucesso na inicialização');
            setLoading(false);
            return true;
          } else {
            console.log('Token inválido retornado pela API');
            // Não remover o token aqui para tentar uma vez mais
            setLoading(false);
            return false;
          }
        } catch (error) {
          console.error('Erro ao verificar autenticação na inicialização:', error);
          setLoading(false);
          return false;
        }
      } else {
        console.log('Nenhum token encontrado no cookie');
        setLoading(false);
        return false;
      }
    };
    
    checkAuthOnLoad();
  }, []);

  // Configurar interceptor do axios para incluir o token em requisições autenticadas
  useEffect(() => {
    // Criar uma nova instância do interceptor para evitar duplicação
    const interceptorId = axios.interceptors.request.use(
      (config) => {
        if (token) {
          console.log('Adicionando token ao header de autorização:', token.substring(0, 15) + '...');
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Limpar o interceptor na desmontagem do componente
    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, [token]);

  // Verificar se o usuário está autenticado
  const checkAuth = async (): Promise<boolean> => {
    // Primeiro tentar com o cookie
    let storedToken = Cookies.get(TOKEN_COOKIE_NAME);
    
    // Se não encontrar no cookie, tentar no localStorage como fallback
    if (!storedToken) {
      try {
        storedToken = localStorage.getItem('auth_token_backup');
        
        // Se encontrado no localStorage mas não no cookie, restaurar o cookie
        if (storedToken) {
          console.log('Token recuperado do localStorage, restaurando cookie');
          Cookies.set(TOKEN_COOKIE_NAME, storedToken, COOKIE_OPTIONS);
        }
      } catch (error) {
        console.error('Erro ao acessar localStorage:', error);
      }
    }
    
    if (!storedToken) {
      console.log('Nenhum token encontrado no cookie ou localStorage');
      return false;
    }

    try {
      console.log('Verificando autenticação com o token');
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`
        }
      });
      
      if (response.data.success) {
        setUser(response.data.data);
        setToken(storedToken); // Assegurar que o token está no estado
        console.log('Autenticação verificada com sucesso');
        return true;
      } else {
        console.log('Token inválido retornado pela API');
        Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
        localStorage.removeItem('auth_token_backup');
        setToken(null);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
      localStorage.removeItem('auth_token_backup');
      setToken(null);
      setUser(null);
      return false;
    }
  };

  // Função auxiliar para salvar token
  const saveToken = (newToken: string) => {
    console.log('Salvando token no cookie:', newToken.substring(0, 10) + '...');
    // Salvar no cookie do lado cliente - não pode ser HttpOnly pelo frontend
    Cookies.set(TOKEN_COOKIE_NAME, newToken, COOKIE_OPTIONS);
    
    // Também armazenar no localStorage como fallback
    try {
      localStorage.setItem('auth_token_backup', newToken);
    } catch (error) {
      console.error('Erro ao salvar token no localStorage:', error);
    }
    
    setToken(newToken);
  };

  // Login
  const signIn = async (email: string, password: string) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/login`, 
        { email, password, useCookies: true }  // Indicar para o backend usar cookies HttpOnly se possível
      );
      
      if (response.data.success) {
        const { token, user } = response.data;
        
        // Se o backend já configurou um cookie HttpOnly, não precisamos configurar 
        // nosso próprio cookie, apenas atualizar o estado
        if (!response.headers['x-auth-cookie-set']) {
          saveToken(token);
        } else {
          setToken(token);
        }
        
        setUser(user);
        return { error: null };
      } else {
        return { error: { message: response.data.error || 'Erro ao fazer login' } };
      }
    } catch (error: any) {
      return { 
        error: { 
          message: error.response?.data?.error || 'Erro ao conectar ao servidor' 
        } 
      };
    }
  };

  // Cadastro
  const signUp = async (username: string, email: string, password: string) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/register`, 
        {
          username,
          email,
          password,
          useCookies: true  // Indicar para o backend usar cookies HttpOnly se possível
        }
      );
      
      if (response.data.success) {
        const { token, user } = response.data;
        
        // Se o backend já configurou um cookie HttpOnly, não precisamos configurar 
        // nosso próprio cookie, apenas atualizar o estado
        if (!response.headers['x-auth-cookie-set']) {
          saveToken(token);
        } else {
          setToken(token);
        }
        
        setUser(user);
        return { error: null };
      } else {
        return { error: { message: response.data.error || 'Erro ao criar conta' } };
      }
    } catch (error: any) {
      return { 
        error: { 
          message: error.response?.data?.error || 'Erro ao conectar ao servidor' 
        } 
      };
    }
  };

  // Logout
  const signOut = () => {
    Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
    localStorage.removeItem('auth_token_backup');
    setToken(null);
    setUser(null);
    
    // Chamar logout na API para limpar também cookies HttpOnly
    axios.get(`${API_URL}/auth/logout`).catch(() => {});
  };

  // Valor do contexto
  const value = {
    user,
    loading,
    token,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    checkAuth,
    setUser,
    setToken
  };

  // Expor o contexto globalmente para permitir verificação de autenticação após carregamento
  useEffect(() => {
    // Expor a função checkAuth na janela global
    window.authContextInstance = {
      checkAuth
    };

    return () => {
      // Limpar na desmontagem
      delete window.authContextInstance;
    };
  }, [checkAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook para usar o contexto de autenticação
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
