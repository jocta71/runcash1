import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  asaasCustomerId?: string; // ID do cliente no sistema Asaas
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
  sameSite: 'lax' as const, // Padrão mais seguro e compatível
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
      
      // Log da resposta completa para debug
      logAuthFlow(`Resposta da API /auth/me: ${JSON.stringify(response.data)}`);
      
      if (response.data) {
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
          logAuthFlow(`Token verificado com sucesso, usuário autenticado: ${userData.id}`);
          setUser(userData);
          setToken(token);
          return true;
        } else {
          // Não conseguiu extrair dados válidos do usuário
          logAuthFlow("Resposta da API não contém dados válidos do usuário");
          logAuthFlow(`Estrutura da resposta: ${JSON.stringify(response.data)}`);
          clearAuthData();
          return false;
        }
      } else {
        // Token inválido - limpar tudo
        logAuthFlow("Token inválido retornado pela API, limpando dados de autenticação");
        clearAuthData();
        return false;
      }
    } catch (error) {
      // Erro na verificação - limpar tudo
      logAuthFlow(`Erro na verificação de token: ${error}`);
      clearAuthData();
      return false;
    }
  };

  // Função auxiliar para salvar token
  const saveToken = (newToken: string) => {
    // Se forçar sem auto-login, não salvar token
    if (forceNoAutoLogin) {
      logAuthFlow("Modo sem auto-login ativado - não salvando token");
      return;
    }
    
    logAuthFlow(`Salvando novo token: ${newToken.substring(0, 15)}...`);
    
    // Detectar ambiente para logs
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    
    // Usar opções de cookie atualizadas
    const cookieOptions = {
      ...COOKIE_OPTIONS,
      secure: isLocalhost ? false : COOKIE_OPTIONS.secure,
    };
    
    logAuthFlow(`Configuração de cookies: secure=${cookieOptions.secure}, sameSite=${cookieOptions.sameSite}`);
    
    // Salvar no cookie do lado cliente
    try {
      Cookies.set(TOKEN_COOKIE_NAME, newToken, cookieOptions);
      logAuthFlow("Token salvo em cookie com sucesso");
    } catch (e) {
      logAuthFlow(`Erro ao salvar cookie: ${e}`);
    }
    
    // Salvar também no localStorage como fallback
    try {
      localStorage.setItem('auth_token_backup', newToken);
      logAuthFlow("Token de backup salvo em localStorage");
    } catch (e) {
      logAuthFlow(`Erro ao salvar em localStorage: ${e}`);
    }
    
    setToken(newToken);
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
        
        // Verificar e vincular cliente Asaas se necessário
        if (!user.asaasCustomerId) {
          try {
            logAuthFlow("Verificando cliente Asaas para usuário existente");
            await createOrLinkAsaasCustomer(user);
          } catch (asaasError) {
            logAuthFlow(`Erro ao verificar cliente Asaas: ${asaasError}`);
            // Não falhar o login por causa disso
          }
        }
        
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
        
        // Criar ou recuperar cliente no Asaas
        try {
          logAuthFlow("Criando ou recuperando cliente no Asaas");
          await createOrLinkAsaasCustomer(user);
        } catch (asaasError) {
          logAuthFlow(`Erro ao criar/vincular cliente Asaas: ${asaasError}`);
          // Não falhar o registro por causa disso
        }
        
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

  // Função para criar ou vincular cliente no Asaas
  const createOrLinkAsaasCustomer = async (user: User) => {
    // Se já tem um customerId, não é necessário criar
    if (user.asaasCustomerId) {
      logAuthFlow(`Usuário já possui ID de cliente Asaas: ${user.asaasCustomerId}`);
      return;
    }
    
    try {
      // Primeiro tentar buscar cliente pelo email
      logAuthFlow(`Buscando cliente no Asaas pelo email: ${user.email}`);
      const findResponse = await axios.get(`${API_URL}/api/asaas-find-customer`, {
        params: { email: user.email }
      });
      
      if (findResponse.data.success) {
        // Cliente encontrado, vincular ao usuário
        const customerId = findResponse.data.customer.id;
        logAuthFlow(`Cliente encontrado no Asaas, ID: ${customerId}, vinculando ao usuário`);
        
        await axios.post(`${API_URL}/api/user-link-asaas`, {
          userId: user.id,
          asaasCustomerId: customerId
        });
        
        // Atualizar objeto do usuário em memória
        setUser({
          ...user,
          asaasCustomerId: customerId
        });
        
        return;
      }
    } catch (findError) {
      // Cliente não encontrado, prosseguir para criar um novo
      logAuthFlow(`Cliente não encontrado no Asaas por email, criando novo`);
    }
    
    // Criar novo cliente no Asaas
    try {
      logAuthFlow(`Criando novo cliente no Asaas para: ${user.email}`);
      const createResponse = await axios.post(`${API_URL}/api/asaas-create-customer`, {
        name: user.username,
        email: user.email,
        userId: user.id
        // cpfCnpj seria ideal, mas não temos nesse momento
      });
      
      if (createResponse.data.success) {
        const customerId = createResponse.data.data.customerId;
        logAuthFlow(`Cliente criado no Asaas, ID: ${customerId}`);
        
        // Atualizar usuário no banco com o ID do cliente
        await axios.post(`${API_URL}/api/user-link-asaas`, {
          userId: user.id,
          asaasCustomerId: customerId
        });
        
        // Atualizar objeto do usuário em memória
        setUser({
          ...user,
          asaasCustomerId: customerId
        });
      }
    } catch (createError) {
      logAuthFlow(`Erro ao criar cliente no Asaas: ${createError}`);
      throw createError;
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
