import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

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
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (username: string, email: string, password: string) => Promise<{ error: any }>;
  signOut: () => void;
  checkAuth: () => Promise<boolean>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

// Cookie options
const COOKIE_OPTIONS = {
  secure: window.location.protocol === "https:", // Usar secure apenas em HTTPS
  sameSite: window.location.protocol === "https:" ? 'none' as const : 'lax' as const, // Usar 'lax' quando não for HTTPS
  path: '/',         // Disponível em todo o site
  expires: 30,       // Expiração em 30 dias
};

// Nome do cookie - deve corresponder ao nome esperado pelo backend
const TOKEN_COOKIE_NAME = 'token';

// Criar contexto com valor padrão
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
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

  // Configuração global do axios para envio de cookies
  useEffect(() => {
    // Configurar axios para sempre enviar credenciais (cookies)
    axios.defaults.withCredentials = true;
  }, []);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const checkAuthOnLoad = async () => {
      // Verificar se há um token do Google Auth na URL
      const urlParams = new URLSearchParams(window.location.search);
      const googleToken = urlParams.get('google_token');
      
      if (googleToken) {
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
      const authResult = await checkAuth();
      setLoading(false);
    };
    
    checkAuthOnLoad();
  }, []);

  // Configurar interceptor do axios para incluir o token em requisições autenticadas
  useEffect(() => {
    // Criar uma nova instância do interceptor para evitar duplicação
    const interceptorId = axios.interceptors.request.use(
      (config) => {
        if (token) {
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
    // Verificar primeiro no cookie (mais rápido)
    const storedToken = Cookies.get(TOKEN_COOKIE_NAME);
    
    // Se token encontrado, verificar com API
    if (storedToken) {
      return verifyTokenWithApi(storedToken);
    }
    
    // Se não encontrar no cookie, tentar no localStorage (fallback)
    const backupToken = localStorage.getItem('auth_token_backup');
    
    // Se encontrou no localStorage mas não no cookie, restaurar no cookie e verificar
    if (backupToken) {
      saveToken(backupToken);
      return verifyTokenWithApi(backupToken);
    }
    
    // Nenhum token encontrado
    return false;
  };

  // Função para verificar o token com a API
  const verifyTokenWithApi = async (token: string): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setUser(response.data.data);
        setToken(token);
        return true;
      } else {
        // Token inválido - limpar tudo
        Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
        localStorage.removeItem('auth_token_backup');
        setToken(null);
        setUser(null);
        return false;
      }
    } catch (error) {
      // Erro na verificação - limpar tudo
      Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
      localStorage.removeItem('auth_token_backup');
      setToken(null);
      setUser(null);
      return false;
    }
  };

  // Função auxiliar para salvar token
  const saveToken = (newToken: string) => {
    // Verificar ambiente atual para ajustar configurações
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    
    // Configurar opções específicas do ambiente
    const cookieOptions = {
      ...COOKIE_OPTIONS,
      // Em ambiente de desenvolvimento local sem HTTPS, desabilitar secure e usar sameSite lax
      secure: isLocalhost ? false : COOKIE_OPTIONS.secure,
      sameSite: isLocalhost ? 'lax' as const : COOKIE_OPTIONS.sameSite
    };
    
    // Salvar no cookie do lado cliente
    Cookies.set(TOKEN_COOKIE_NAME, newToken, cookieOptions);
    
    // Salvar também no localStorage como fallback
    localStorage.setItem('auth_token_backup', newToken);
    
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
    // Limpar cookie com várias opções para garantir remoção
    Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
    Cookies.remove(TOKEN_COOKIE_NAME);
    
    // Limpar localStorage
    localStorage.removeItem('auth_token_backup');
    
    // Limpar estados
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
    signIn,
    signUp,
    signOut,
    checkAuth,
    setUser,
    setToken
  };

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
