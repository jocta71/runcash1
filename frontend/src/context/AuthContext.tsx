import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  asaasCustomerId?: string; // ID do cliente no Asaas
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

// Cookie options - opções atualizadas para melhor compatibilidade entre navegadores
const COOKIE_OPTIONS = {
  secure: window.location.protocol === "https:", // Usar secure apenas em HTTPS
  sameSite: 'strict' as const, // Alterado para strict para maior segurança
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
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Flag para evitar logins automáticos indesejados - alterando para false para permitir persistência de login
  const [forceNoAutoLogin] = useState(false);

  // Log de debug para entender o fluxo de autenticação
  const logAuthFlow = (message: string) => {
    console.log(`[AUTH] ${message}`);
  };

  // Limpar todos os dados de autenticação do cliente
  const clearAuthData = () => {
    logAuthFlow("Limpando todos os dados de autenticação");
    
    // Limpar cookies com várias opções para garantir remoção
    Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
    Cookies.remove(TOKEN_COOKIE_NAME);
    
    // Limpar localStorage
    localStorage.removeItem('auth_token_backup');
    
    // Limpar estados
    setToken(null);
    setUser(null);
  };

  // Configuração global do axios para envio de cookies
  useEffect(() => {
    // Configurar axios para sempre enviar credenciais (cookies)
    axios.defaults.withCredentials = true;
    
    logAuthFlow("Axios configurado para enviar credenciais");
  }, []);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const checkAuthOnLoad = async () => {
      logAuthFlow("Iniciando verificação de autenticação");
      
      // Verificação de ambiente para logs
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      logAuthFlow(`Ambiente: ${isLocalhost ? 'Desenvolvimento local' : 'Produção'}`);
      logAuthFlow(`Protocolo: ${window.location.protocol}`);
      
      // Se forçar sem auto-login, remover qualquer dado de autenticação existente
      if (forceNoAutoLogin) {
        logAuthFlow("Modo sem auto-login ativado - removendo dados de autenticação existentes");
        clearAuthData();
        setLoading(false);
        return false;
      }
      
      // Verificar se há um token do Google Auth na URL
      const urlParams = new URLSearchParams(window.location.search);
      const googleToken = urlParams.get('google_token');
      
      if (googleToken) {
        logAuthFlow("Token Google encontrado na URL");
        
        // Salvar o token e limpar a URL
        saveToken(googleToken);
        
        // Carregar os dados do usuário
        try {
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${googleToken}`
            }
          });
          
          // Log da resposta completa para debug
          logAuthFlow(`Resposta da API /auth/me (Google): ${JSON.stringify(response.data)}`);
          
          // Tenta diferentes estruturas possíveis da resposta
          let userData = null;
          
          if (response.data.data) {
            // Estrutura esperada: { success: true, data: { ... } }
            userData = response.data.data;
            logAuthFlow("Usando dados do usuário de response.data.data");
          } else if (response.data.user) {
            // Estrutura alternativa: { success: true, user: { ... } }
            userData = response.data.user;
            logAuthFlow("Usando dados do usuário de response.data.user");
          } else if (response.data.id) {
            // O próprio objeto de resposta pode ser o usuário
            userData = response.data;
            logAuthFlow("Usando dados do usuário diretamente de response.data");
          }
          
          if (userData && userData.id) {
            logAuthFlow("Usuário autenticado via Google com sucesso");
            setUser(userData);
            
            // Limpar o token da URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            logAuthFlow("Resposta da API não contém dados válidos do usuário (Google)");
            clearAuthData();
          }
        } catch (error) {
          logAuthFlow(`Erro ao carregar usuário após login do Google: ${error}`);
          clearAuthData();
        }
        
        setLoading(false);
        return true;
      }
      
      // Verificação normal de autenticação
      const authResult = await checkAuth();
      setLoading(false);
      return authResult;
    };
    
    checkAuthOnLoad();
  }, [forceNoAutoLogin]);

  // Configurar interceptor do axios para incluir o token em requisições autenticadas
  useEffect(() => {
    // Criar uma nova instância do interceptor para evitar duplicação
    const interceptorId = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          // Log para debug quando o token é aplicado em requisições
          if (config.url?.includes('/api/')) {
            logAuthFlow(`Token aplicado para requisição: ${config.url}`);
          }
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
    logAuthFlow("Verificando autenticação");
    
    // Se forçar sem auto-login, sempre retornar falso
    if (forceNoAutoLogin) {
      logAuthFlow("Modo sem auto-login ativado - ignorando verificação de autenticação");
      return false;
    }
    
    // Verificar primeiro no cookie (mais rápido)
    const storedToken = Cookies.get(TOKEN_COOKIE_NAME);
    
    // Se token encontrado, verificar com API
    if (storedToken) {
      logAuthFlow("Token encontrado no cookie, verificando com API");
      return verifyTokenWithApi(storedToken);
    }
    
    // Se não encontrar no cookie, tentar no localStorage (fallback)
    const backupToken = localStorage.getItem('auth_token_backup');
    
    // Se encontrou no localStorage mas não no cookie, restaurar no cookie e verificar
    if (backupToken) {
      logAuthFlow("Token encontrado apenas no localStorage, restaurando e verificando");
      saveToken(backupToken);
      return verifyTokenWithApi(backupToken);
    }
    
    // Nenhum token encontrado
    logAuthFlow("Nenhum token encontrado, usuário não está autenticado");
    return false;
  };

  // Função para verificar o token com a API
  const verifyTokenWithApi = async (token: string): Promise<boolean> => {
    logAuthFlow("Verificando token com a API");
    
    // Se forçar sem auto-login, sempre retornar falso
    if (forceNoAutoLogin) {
      logAuthFlow("Modo sem auto-login ativado - ignorando verificação de token");
      return false;
    }
    
    try {
      logAuthFlow(`Chamando API /auth/me com token: ${token.substring(0, 15)}...`);
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Verificar formato da resposta e extrair dados do usuário
      let userData = null;
      if (response.data.data) {
        userData = response.data.data;
        logAuthFlow("Usando dados do usuário de response.data.data");
      } else if (response.data.user) {
        userData = response.data.user;
        logAuthFlow("Usando dados do usuário de response.data.user");
      } else if (response.data.id) {
        userData = response.data;
        logAuthFlow("Usando dados do usuário diretamente de response.data");
      }
      
      if (userData && userData.id) {
        logAuthFlow("Usuário autenticado com sucesso via API");
        setUser(userData);
        setToken(token); // Garantir que o token seja definido
        return true;
      } else {
        logAuthFlow("Resposta da API não contém dados válidos do usuário");
        clearAuthData();
        return false;
      }
    } catch (error) {
      logAuthFlow(`Erro ao verificar token: ${error}`);
      clearAuthData();
      return false;
    }
  };

  // Salvar o token em cookie e localStorage (backup)
  const saveToken = (newToken: string) => {
    logAuthFlow(`Salvando token: ${newToken.substring(0, 15)}...`);
    
    // Definir nos estados
    setToken(newToken);
    
    // Armazenar no cookie
    try {
      Cookies.set(TOKEN_COOKIE_NAME, newToken, {
        ...COOKIE_OPTIONS,
        // Definir o domínio automaticamente (remove para funcionar em qualquer domínio)
        domain: undefined
      });
      logAuthFlow("Token salvo no cookie com sucesso");
    } catch (error) {
      logAuthFlow(`Erro ao salvar token no cookie: ${error}`);
    }

    // Armazenar no localStorage como backup
    try {
      localStorage.setItem('auth_token_backup', newToken);
      logAuthFlow("Token de backup salvo no localStorage com sucesso");
      
      // Adicionar timestamp para verificar validade do backup
      localStorage.setItem('auth_token_timestamp', Date.now().toString());
    } catch (error) {
      logAuthFlow(`Erro ao salvar token de backup: ${error}`);
    }
  };

  // Login
  const signIn = async (email: string, password: string) => {
    logAuthFlow(`Tentando login para: ${email}`);
    
    try {
      const response = await axios.post(
        `${API_URL}/auth/login`, 
        { email, password, useCookies: true }  // Indicar para o backend usar cookies HttpOnly se possível
      );
      
      if (response.data.success) {
        const { token, user } = response.data;
        
        logAuthFlow("Login bem-sucedido");
        
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
        logAuthFlow(`Falha no login: ${response.data.error}`);
        return { error: { message: response.data.error || 'Erro ao fazer login' } };
      }
    } catch (error: any) {
      logAuthFlow(`Erro durante login: ${error.message}`);
      return { 
        error: { 
          message: error.response?.data?.error || 'Erro ao conectar ao servidor' 
        } 
      };
    }
  };

  // Cadastro
  const signUp = async (username: string, email: string, password: string) => {
    logAuthFlow(`Tentando cadastro para: ${email}`);
    
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
        
        logAuthFlow("Cadastro bem-sucedido");
        
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
        logAuthFlow(`Falha no cadastro: ${response.data.error}`);
        return { error: { message: response.data.error || 'Erro ao criar conta' } };
      }
    } catch (error: any) {
      logAuthFlow(`Erro durante cadastro: ${error.message}`);
      return { 
        error: { 
          message: error.response?.data?.error || 'Erro ao conectar ao servidor' 
        } 
      };
    }
  };

  // Logout
  const signOut = () => {
    logAuthFlow("Realizando logout");
    
    // Limpar todo o estado de autenticação
    clearAuthData();
    
    // Chamar logout na API para limpar também cookies HttpOnly
    axios.get(`${API_URL}/auth/logout`).catch((error) => {
      logAuthFlow(`Erro ao chamar logout na API: ${error}`);
    });
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
