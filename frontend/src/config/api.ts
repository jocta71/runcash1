// Configuração centralizada para chamadas de API
const API_URL = import.meta.env.VITE_API_URL || 'https://backend-production-2f96.up.railway.app';

// Objeto com todas as rotas de API
const API_ROUTES = {
  // Rotas de pagamento
  payment: {
    createSubscription: `${API_URL}/api/subscription/create`,
    regeneratePixCode: `${API_URL}/api/payment/regenerate-pix`,
    checkStatus: `${API_URL}/api/payment/check-status`,
    pixQrCode: `${API_URL}/api/payment/pix-qrcode`,
  },
  // Rotas de usuário
  user: {
    subscriptions: `${API_URL}/api/user/subscriptions`,
    profile: `${API_URL}/api/user/profile`,
  },
  // Rotas de webhook
  webhook: {
    asaas: `${API_URL}/api/webhook/asaas`,
  },
  // Outras rotas conforme necessário
};

export default API_ROUTES; 