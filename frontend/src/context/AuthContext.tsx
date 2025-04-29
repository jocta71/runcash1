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

// Configuração robusta de cookies
const COOKIE_OPTIONS = {
  secure: window.location.protocol === "https:", // Usar secure apenas em HTTPS
  sameSite: 'lax' as const,     // Modificado para lax para melhor compatibilidade
  path: '/',                    // Disponível em todo o site
  expires: 30,                  // Expiração em 30 dias
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
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    localStorage.removeItem('auth_user_cache');
    localStorage.removeItem('auth_token_timestamp');
    
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

  // Configurar interceptor para lidar com erros de autenticação
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Verificar se é erro de autenticação (401) e não é uma requisição de refresh
        if (axios.isAxiosError(error) && 
            error.response?.status === 401 && 
            !error.config.url?.includes('/auth/refresh') && 
            !error.config.url?.includes('/auth/login') &&
            !isRefreshing) {
          
          logAuthFlow("Interceptando erro 401, tentando recuperar sessão");
          setIsRefreshing(true);
          
          try {
            // No futuro, implementar refresh token aqui
            // Por enquanto, verificar o token de backup
            const backupToken = localStorage.getItem('auth_token_backup');
            
            if (backupToken) {
              logAuthFlow("Tentando recuperar sessão com token de backup");
              
              // Verificar token de backup com a API
              const isValid = await verifyTokenWithApi(backupToken);
              
              if (isValid) {
                logAuthFlow("Sessão recuperada com sucesso");
                
                // Refazer a requisição original
                error.config.headers.Authorization = `Bearer ${backupToken}`;
                return axios(error.config);
              }
            }
            
            logAuthFlow("Falha ao recuperar sessão");
            return Promise.reject(error);
          } catch (refreshError) {
            logAuthFlow(`Erro ao tentar recuperar sessão: ${refreshError}`);
            return Promise.reject(error);
          } finally {
            setIsRefreshing(false);
          }
        }
        
        return Promise.reject(error);
      }
    );
    
    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [isRefreshing]);

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
            
            // Armazenar cache do usuário
            try {
              localStorage.setItem('auth_user_cache', JSON.stringify(userData));
            } catch (e) {
              logAuthFlow(`Erro ao salvar cache do usuário: ${e}`);
            }
            
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

  // Verificar se o usuário está autenticado - Implementação robusta
  const checkAuth = async (): Promise<boolean> => {
    logAuthFlow("Verificando autenticação");
    
    // Se forçar sem auto-login, sempre retornar falso
    if (forceNoAutoLogin) {
      logAuthFlow("Modo sem auto-login ativado - ignorando verificação de autenticação");
      return false;
    }
    
    try {
      // Se já temos usuário e token em memória, considerar autenticado sem verificar API
      if (user && token) {
        logAuthFlow("Usuário já autenticado em memória, pulando verificação com API");
        return true;
      }
      
      // Verificar primeiro no cookie (mais rápido)
      let storedToken = Cookies.get(TOKEN_COOKIE_NAME);
      
      // Se não encontrar no cookie padrão, tentar no alternativo
      if (!storedToken) {
        storedToken = Cookies.get(`${TOKEN_COOKIE_NAME}_alt`);
        if (storedToken) {
          logAuthFlow("Token encontrado no cookie alternativo");
        }
      } else {
        logAuthFlow("Token encontrado no cookie padrão");
      }
      
      // Se ainda não encontrou, tentar no localStorage (mais confiável entre recargas)
      if (!storedToken) {
        storedToken = localStorage.getItem('auth_token_backup');
        if (storedToken) {
          logAuthFlow("Token encontrado no localStorage");
          
          // Se token só existe no localStorage, restaurar no cookie para futuras requisições
          try {
            const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            Cookies.set(TOKEN_COOKIE_NAME, storedToken, {
              ...COOKIE_OPTIONS,
              sameSite: isLocalhost ? 'lax' as const : 'none' as const,
              secure: isLocalhost ? false : true,
            });
            logAuthFlow("Token restaurado do localStorage para o cookie");
          } catch (e) {
            logAuthFlow(`Erro ao restaurar token para cookie: ${e}`);
          }
        }
      }
      
      // Se token encontrado, verificar com API
      if (storedToken) {
        try {
          // Definir o token no estado antes mesmo de verificar com a API
          if (!token) {
            logAuthFlow("Definindo token no estado");
            setToken(storedToken);
          }
          
          // Verificar usuário em cache primeiro para experiência mais rápida
          const cachedUser = localStorage.getItem('auth_user_cache');
          if (cachedUser) {
            try {
              const userData = JSON.parse(cachedUser);
              setUser(userData);
              logAuthFlow("Usando dados de usuário em cache temporariamente");
            } catch (e) {
              logAuthFlow(`Erro ao analisar cache do usuário: ${e}`);
            }
          }
          
          // Verificar token com a API (mesmo que já tenhamos dados em cache)
          const isValid = await verifyTokenWithApi(storedToken);
          if (isValid) return true;
        } catch (error) {
          // Tratar erro de verificação
          logAuthFlow(`Erro ao verificar token: ${error}`);
          // Se for erro de rede, usar cache local e confiar no token
          if (axios.isAxiosError(error) && !error.response) {
            logAuthFlow("Erro de rede. Verificando cache local.");
            
            // Verificar se temos usuário em cache
            const cachedUser = localStorage.getItem('auth_user_cache');
            if (cachedUser) {
              try {
                const userData = JSON.parse(cachedUser);
                setUser(userData);
                logAuthFlow("Usando dados de usuário em cache com o token");
                return true;
              } catch (e) {
                logAuthFlow(`Erro ao analisar cache do usuário: ${e}`);
              }
            }
            
            // Mesmo sem cache de usuário, manter o token em caso de erro de rede
            return true;
          }
        }
      }
      
      // Se chegou até aqui, não encontrou token válido
      logAuthFlow("Nenhum token válido encontrado");
      clearAuthData();
      return false;
    } catch (error) {
      logAuthFlow(`Erro durante verificação de autenticação: ${error}`);
      return false;
    }
  };

  // Função para verificar o token com a API - Com tratamento robusto
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
      
      // Qualquer resposta 2xx é considerada sucesso
      if (response.status >= 200 && response.status < 300) {
        logAuthFlow(`Resposta bem-sucedida da API: ${response.status}`);
        
        // Log da resposta completa para melhor diagnóstico
        try {
          logAuthFlow(`Resposta da API /auth/me: ${JSON.stringify(response.data)}`);
        } catch (e) {
          logAuthFlow(`Não foi possível logar a resposta completa: ${e}`);
        }
        
        // Verificar formato da resposta e extrair dados do usuário com tratamento de erro mais robusto
        let userData = null;
        
        // Tratamento específico para o formato da rota /auth/me
        // Esta rota retorna { success: true, data: { user object } }
        try {
          if (response.data && typeof response.data === 'object') {
            logAuthFlow("Analisando formato da resposta...");
            
            // Formato principal da API /auth/me: { success: true, data: { user } }
            if (response.data.success === true && response.data.data && typeof response.data.data === 'object') {
              // Verificar se data contém os campos esperados de um usuário
              if (response.data.data._id || response.data.data.id || 
                  response.data.data.email || response.data.data.username) {
                userData = response.data.data;
                logAuthFlow("Formato detectado: { success: true, data: user object }");
              }
            } 
            // Formato alternativo: { user: user object }
            else if (response.data.user && typeof response.data.user === 'object') {
              userData = response.data.user;
              logAuthFlow("Formato detectado: { user: user object }");
            } 
            // Formato direto: user object
            else if (response.data._id || response.data.id || 
                     response.data.email || response.data.username) {
              userData = response.data;
              logAuthFlow("Formato detectado: user object direto");
            }
            
            // Log dos dados extraídos para debug
            if (userData) {
              logAuthFlow(`Dados do usuário extraídos: ID=${userData._id || userData.id}, Email=${userData.email}`);
            } else {
              logAuthFlow("Não foi possível extrair dados do usuário da resposta");
              logAuthFlow(`Estrutura da resposta: ${Object.keys(response.data).join(', ')}`);
              if (response.data.data) {
                logAuthFlow(`Estrutura de data: ${Object.keys(response.data.data).join(', ')}`);
              }
            }
          }
        } catch (parseError) {
          logAuthFlow(`Erro ao analisar resposta: ${parseError}`);
        }
        
        // Verificar se temos um objeto userData válido com ID
        if (userData && (userData._id || userData.id)) {
          logAuthFlow(`Usuário autenticado com sucesso via API: ${userData.username || userData.email}`);
          
          // Normalizar o ID do usuário (alguns endpoints usam _id, outros id)
          const normalizedUser = {
            ...userData,
            id: userData.id || userData._id
          };
          
          setUser(normalizedUser);
          setToken(token); // Garantir que o token seja definido
          
          // Armazenar cache do usuário
          try {
            localStorage.setItem('auth_user_cache', JSON.stringify(normalizedUser));
            logAuthFlow("Cache do usuário salvo no localStorage");
          } catch (e) {
            logAuthFlow(`Erro ao salvar cache do usuário: ${e}`);
          }
          
          return true;
        } else {
          // Se a API retornou sucesso mas não conseguimos extrair o usuário,
          // manter o token válido (token só é inválido se API retornar 401/403)
          logAuthFlow("Resposta da API bem-sucedida, mas formato não reconhecido. Mantendo token.");
          
          // Verificar se já temos usuário em memória
          if (user) {
            logAuthFlow("Mantendo dados de usuário já existentes em memória");
            return true;
          }
          
          // Verificar se temos usuário em cache
          const cachedUser = localStorage.getItem('auth_user_cache');
          if (cachedUser) {
            try {
              const userData = JSON.parse(cachedUser);
              setUser(userData);
              logAuthFlow("Usando dados de usuário em cache");
              return true;
            } catch (e) {
              logAuthFlow(`Erro ao analisar cache do usuário: ${e}`);
            }
          }
          
          // Token é válido mesmo sem usuário
          return true;
        }
      } else {
        logAuthFlow(`Resposta da API não confirma validade do token: ${response.status}`);
        return false;
      }
    } catch (error) {
      // Verificar se é erro de conexão antes de limpar a autenticação
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          logAuthFlow(`Erro de conexão ao verificar token: ${error}`);
          // Não limpar autenticação para erros de conexão
          return true; // Manter usuário logado se for apenas erro de conexão
        }
        
        // Erros específicos
        if (error.response.status === 401 || error.response.status === 403) {
          logAuthFlow(`Token inválido ou expirado (${error.response.status})`);
          return false;
        }
      }
      
      // Para outros erros de servidor, não invalidar token automaticamente
      logAuthFlow(`Erro ao verificar token: ${error}`);
      return true; // Manter usuário logado em caso de erros não específicos
    }
  };

  // Salvar o token em cookie e localStorage (backup) - Estratégia robusta
  const saveToken = (newToken: string) => {
    logAuthFlow(`Salvando token: ${newToken.substring(0, 15)}...`);
    
    // Definir nos estados
    setToken(newToken);
    
    // Armazenar no cookie (principal)
    try {
      // Detectar se estamos em localhost para ajustar configurações
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      
      // Configuração adaptativa para cookies
      const cookieConfig = {
        ...COOKIE_OPTIONS,
        // Ajustar sameSite e secure conforme ambiente
        sameSite: isLocalhost ? 'lax' as const : 'none' as const,
        secure: isLocalhost ? false : true,
        // Remover domínio para maior compatibilidade
        domain: undefined
      };
      
      Cookies.set(TOKEN_COOKIE_NAME, newToken, cookieConfig);
      logAuthFlow(`Token salvo no cookie com configuração: ${JSON.stringify(cookieConfig)}`);
      
      // Adicionar cookie alternativo com configurações diferentes para maior compatibilidade
      const altCookieConfig = {
        path: '/',
        expires: 30,
        sameSite: 'lax' as const,
        secure: window.location.protocol === "https:",
      };
      
      Cookies.set(`${TOKEN_COOKIE_NAME}_alt`, newToken, altCookieConfig);
      logAuthFlow(`Token alternativo salvo no cookie com configuração: ${JSON.stringify(altCookieConfig)}`);
    } catch (error) {
      logAuthFlow(`Erro ao salvar token no cookie: ${error}`);
    }

    // Armazenar no localStorage como backup principal (mais confiável entre recargas)
    try {
      localStorage.setItem('auth_token_backup', newToken);
      logAuthFlow("Token de backup salvo no localStorage com sucesso");
      
      // Adicionar timestamp para verificar validade do backup
      localStorage.setItem('auth_token_timestamp', Date.now().toString());
    } catch (error) {
      logAuthFlow(`Erro ao salvar token de backup: ${error}`);
    }
  };

  // Login - Implementação robusta
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
        
        // Armazenar cache do usuário
        try {
          localStorage.setItem('auth_user_cache', JSON.stringify(user));
        } catch (e) {
          logAuthFlow(`Erro ao salvar cache do usuário: ${e}`);
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

  // Cadastro - Mantido similar, com adição de cache
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
        
        // Armazenar cache do usuário
        try {
          localStorage.setItem('auth_user_cache', JSON.stringify(user));
        } catch (e) {
          logAuthFlow(`Erro ao salvar cache do usuário: ${e}`);
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

  // Criar objeto de contexto a ser fornecido
  const contextValue: AuthContextType = {
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

  // Renderizar o Provider com o valor do contexto
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para usar o contexto de autenticação
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
};

// Exportar o Provider para uso no App
export default AuthContext;
