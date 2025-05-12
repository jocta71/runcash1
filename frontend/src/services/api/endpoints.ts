// Verificar a configuração atual do ambiente
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

// Determinar API base URL com base no ambiente
let API_BASE_URL = '';

// Use API do backend em produção ou staging
if (isProduction || isVercel) {
  API_BASE_URL = 'https://starfish-app-fubxw.ondigitalocean.app';
} else {
  // Em desenvolvimento local
  API_BASE_URL = 'http://localhost:3001';
}

// Definir caminhos relativos dos endpoints
const API_PATHS = {
  STREAM_ROULETTES: '/api/stream/roulettes'
};

// Definir base URL com base no ambiente
export const BASE_URL = API_BASE_URL;

// Endpoint unificado para o streaming SSE
export const SSE_STREAM_URL = `${API_BASE_URL}${API_PATHS.STREAM_ROULETTES}`;

console.log('🔌 Endpoints configurados:', {
  base: BASE_URL,
  sseStream: SSE_STREAM_URL,
  env: process.env.NODE_ENV,
  isVercel
});

// Função para obter URL completa
export const getFullUrl = (endpoint: string) => {
  // Se já for uma URL completa (começando com http), retornar como está
  if (endpoint.startsWith('http')) {
    return endpoint;
  }
  
  // Se começar com '/', remover a barra para evitar barras duplas
  const sanitizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  // Retornar URL completa
  return `${API_BASE_URL}/${sanitizedEndpoint}`;
};

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    GOOGLE: '/api/auth/google',
    GOOGLE_CALLBACK: '/api/auth/google/callback',
    GOOGLE_STATUS: '/api/auth/google/status',
  },
  ROULETTE: {
    // DEPRECIADO: Use a API de streaming SSE_STREAM_URL em vez destes endpoints
    ALL: '/api/roulettes', // DEPRECIADO: Use SSE_STREAM_URL para obter todas as roletas
    SEARCH: '/api/roulettes/search', // DEPRECIADO: Use SSE_STREAM_URL e filtre localmente
    NUMBERS: '/api/roulettes/numbers', // DEPRECIADO: Use SSE_STREAM_URL para obter números
    BY_ID: (id: string) => `/api/roulettes/${id}`, // DEPRECIADO: Use SSE_STREAM_URL e filtre por ID
    NUMBERS_BY_ID: (id: string) => `/api/roulettes/${id}/numbers`, // DEPRECIADO: Use SSE_STREAM_URL
    ANALYZE: (id: string) => `/api/roulettes/${id}/analyze`, // DEPRECIADO: Use SSE_STREAM_URL
  },
  SOCKET: {
    CONNECT: '/socket.io',
  },
  STREAM: {
    // Usar o caminho relativo definido acima
    ROULETTES: API_PATHS.STREAM_ROULETTES,
    
    // Endpoint para estatísticas do serviço de streaming
    STATS: '/api/stream/stats',
    
    // Endpoint para diagnóstico do serviço de streaming
    DIAGNOSTIC: '/api/stream/diagnostic'
  },
  HEALTH: {
    CHECK: '/api/health',
  },
  ASAAS: {
    WEBHOOK: '/api/asaas-webhook',
    FIND_SUBSCRIPTION: '/api/asaas-find-subscription',
    CANCEL_SUBSCRIPTION: '/api/asaas-cancel-subscription',
    CREDIT_CARD_PAYMENT: '/api/asaas-credit-card-payment',
    PIX_PAYMENT: '/api/asaas-pix-payment',
  },
  STRIPE: {
    CREATE_CHECKOUT_SESSION: '/api/stripe/create-checkout-session',
    CHECKOUT_STATUS: '/api/stripe/checkout-status',
  },
  SUBSCRIPTION: {
    GET: '/api/subscription',
    CREATE: '/api/subscription/create',
    CANCEL: '/api/subscription/cancel',
  },
  USER: {
    UPDATE: '/api/user/update',
  },
  PLANS: {
    ALL: '/api/plans',
    BY_ID: (id: string) => `/api/plans/${id}`,
  },
  PAYMENTS: {
    STATUS: '/api/payments/status',
    HISTORY: '/api/payments/history',
  },
  HISTORICAL: {
    ALL_ROULETTES: '/api/historical/all-roulettes',
    BY_ROULETTE: (id: string) => `/api/historical/${id}`,
  },
  METRICS: {
    TRACK: '/api/metrics/track',
  },
  ACCESS_KEY: {
    GET_ALL: '/api/access-key',
    CREATE: '/api/access-key/create',
    DELETE: (id: string) => `/api/access-key/${id}`,
  },
}; 