import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

// Configuração base para o cliente axios
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Importante para cookies de sessão
});

// Interceptor para adicionar o token JWT em todas as requisições
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Obter token do cookie ou localStorage
    const token = Cookies.get('token') || localStorage.getItem('auth_token_backup');
    
    // Se o token existir, adicionar ao header Authorization
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para lidar com erros de resposta
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Se for erro 401 (Não Autorizado)
    if (error.response && error.response.status === 401) {
      console.error('[API] Erro de autenticação:', error.response.data);
      
      // Aqui você pode implementar lógica para redirecionar para login
      // ou tentar renovar o token se você tiver um refresh token
    }
    
    // Se for erro 403 (Proibido - problema de assinatura)
    if (error.response && error.response.status === 403) {
      console.error('[API] Acesso negado:', error.response.data);
      
      // Verificar se é erro relacionado à assinatura
      if (error.response.data.requiresSubscription) {
        // Aqui você pode implementar lógica para redirecionar para página de assinatura
        console.warn('[API] Assinatura necessária para acessar este recurso');
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient; 