import axios from 'axios';

// Criar uma instância do axios para requisições à API
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || window.location.origin,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Adicionar interceptador para incluir token de autenticação
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptador para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Tratamento de erro de autenticação (401)
    if (error.response && error.response.status === 401) {
      // Redirecionar para login se não estiver autenticado
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api; 