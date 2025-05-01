import axios from 'axios';
import simulatedApi from '../pages/api/simulateApi';

// Interceptor para simular a API em ambiente de desenvolvimento
export const setupMockApiInterceptors = () => {
  // Interceptar requisições
  axios.interceptors.request.use(async (config) => {
    // Verificar se é uma rota de API de teste
    if (config.url?.startsWith('/api/')) {
      console.log(`[MockAPI] Interceptando requisição para: ${config.url}`);
      
      // Permitir que requisições reais sigam para o servidor
      // Este é apenas um mock para testes
      return config;
    }
    
    return config;
  });
  
  // Interceptar respostas
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Se houver erro e for uma rota de API de teste, simular resposta
      if (error.config?.url?.startsWith('/api/')) {
        console.log(`[MockAPI] Simulando resposta para requisição com erro: ${error.config.url}`);
        
        try {
          // Tentar simular a resposta baseada na URL
          const mockResponse = await simulateApiResponse(error.config);
          return Promise.resolve(mockResponse);
        } catch (mockError) {
          console.error('[MockAPI] Erro ao simular resposta:', mockError);
          return Promise.reject(error);
        }
      }
      
      return Promise.reject(error);
    }
  );
};

// Simular respostas de API baseadas na URL e método
const simulateApiResponse = async (config: any) => {
  const { url, method, data } = config;
  
  // Converter string JSON para objeto, se necessário
  const requestData = typeof data === 'string' ? JSON.parse(data) : data;
  
  console.log(`[MockAPI] Simulando ${method} ${url} com dados:`, requestData);
  
  // Simular diferentes endpoints
  switch (true) {
    // Registro
    case url === '/api/auth/register' && method.toLowerCase() === 'post':
      return {
        data: await simulatedApi.register(requestData),
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
      
    // Login
    case url === '/api/auth/login' && method.toLowerCase() === 'post':
      return {
        data: await simulatedApi.login(requestData),
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
      
    // Criar cliente no Asaas
    case url === '/api/asaas-create-customer' && method.toLowerCase() === 'post':
      return {
        data: await simulatedApi.createCustomer(requestData),
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
      
    // Criar assinatura
    case url === '/api/asaas-create-subscription' && method.toLowerCase() === 'post':
      return {
        data: await simulatedApi.createSubscription(requestData),
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
      
    // Verificar status da assinatura
    case url === '/api/subscription/status' && method.toLowerCase() === 'get':
      return {
        data: await simulatedApi.checkSubscriptionStatus('user_test'),
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
      
    // Simular aprovação de pagamento
    case url === '/api/simulate-payment-approval' && method.toLowerCase() === 'post':
      return {
        data: await simulatedApi.approvePayment(requestData.subscriptionId),
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
      
    // Buscar dados de roletas
    case url === '/api/roulettes' && method.toLowerCase() === 'get':
      return {
        data: await simulatedApi.getRoulettes('user_test'),
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      };
      
    // Fallback para endpoint não simulado
    default:
      console.warn(`[MockAPI] Endpoint não simulado: ${method} ${url}`);
      throw new Error(`Endpoint não simulado: ${method} ${url}`);
  }
};

// Inicializar simulação de API
export const initMockApi = () => {
  console.log('[MockAPI] Inicializando mock API para testes');
  setupMockApiInterceptors();
  
  // Inicializar banco de dados de teste
  simulatedApi.loadDatabase();
  
  // Se não houver nenhum usuário, criar um usuário de teste
  const testDatabase = JSON.parse(localStorage.getItem('subscription_test_database') || '{"users":[]}');
  if (!testDatabase.users || testDatabase.users.length === 0) {
    console.log('[MockAPI] Criando usuário de teste inicial');
    simulatedApi.register({
      username: 'Usuário Teste',
      email: 'teste@exemplo.com',
      password: 'senha123',
      cpf: '12345678900',
      phone: '11999999999'
    }).catch(err => console.error('[MockAPI] Erro ao criar usuário de teste:', err));
  }
};

export default {
  init: initMockApi
}; 