import axios from 'axios';

// Criação da instância do axios com configurações padrão
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar o token de autenticação em cada requisição
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('@runcash:token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratamento global de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    
    // Se for erro de autenticação (401), pode deslogar o usuário
    if (response?.status === 401) {
      // Evento para notificar que o token expirou
      const event = new CustomEvent('auth:tokenExpired');
      window.dispatchEvent(event);
    }
    
    return Promise.reject(error);
  }
); 