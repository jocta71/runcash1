/**
 * Cliente para integração com Asaas - MODO TESTE DIRETO
 * Aviso: Este código é apenas para testes e não deve ser usado em produção
 * Conecta diretamente à API do Asaas sem passar pelo backend
 */

import axios from 'axios';
import config from '@/config/env';

// Chave API de sandbox para testes - NUNCA use chaves reais no frontend
// Esta chave é apenas para testes e deve ser substituída por uma implementação segura via backend
const ASAAS_SANDBOX_KEY = '$aass_sandbox$'; // Substitua por uma chave de sandbox para testes

// Criar instância específica para requisições diretas ao Asaas (apenas testes)
const asaasDirectClient = axios.create({
  baseURL: 'https://sandbox.asaas.com/api/v3',
  headers: {
    'Content-Type': 'application/json',
    'access_token': ASAAS_SANDBOX_KEY
  }
});

// Cliente original para backend (mantenha para referência)
const apiClient = axios.create({
  baseURL: config.apiBaseUrl || 'https://backendapi-production-36b5.up.railway.app'
});

// Log da URL base usada
console.log('Asaas API client usando URL base:', apiClient.defaults.baseURL);

/**
 * Cria um cliente no Asaas ou recupera um existente
 * Em produção, usa o backend. Em modo de teste, pode conectar diretamente.
 * @param userData Dados do usuário (nome, email, cpf/cnpj, telefone)
 */
export const createAsaasCustomer = async (userData: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
}): Promise<string> => {
  // Em produção, sempre usar o backend para segurança
  if (config.isProduction) {
    return createAsaasCustomerViaBackend(userData);
  }
  
  try {
    console.log('Criando/recuperando cliente no Asaas (modo direto):', userData);
    
    // Primeiro verifica se o cliente já existe pelo CPF/CNPJ
    const searchResponse = await asaasDirectClient.get('/customers', {
      params: { cpfCnpj: userData.cpfCnpj.replace(/\D/g, '') }
    });
    
    let customerId;
    
    // Se cliente já existe, usar o ID existente
    if (searchResponse.data.data && searchResponse.data.data.length > 0) {
      customerId = searchResponse.data.data[0].id;
      console.log('Cliente já existe no Asaas, ID:', customerId);
      
      // Atualiza os dados do cliente existente
      await asaasDirectClient.post(`/customers/${customerId}`, {
        name: userData.name,
        email: userData.email,
        mobilePhone: userData.mobilePhone?.replace(/\D/g, '')
      });
      
      console.log('Dados do cliente atualizados com sucesso');
    } else {
      // Cria um novo cliente
      const customerData = {
        name: userData.name,
        email: userData.email,
        cpfCnpj: userData.cpfCnpj.replace(/\D/g, ''),
        mobilePhone: userData.mobilePhone?.replace(/\D/g, ''),
        notificationDisabled: false
      };
      
      const createResponse = await asaasDirectClient.post('/customers', customerData);
      customerId = createResponse.data.id;
      console.log('Novo cliente criado no Asaas, ID:', customerId);
    }
    
    return customerId;
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas (modo direto):', error);
    
    // Em caso de erro no modo direto, tentar via backend como fallback
    console.log('Tentando criar cliente via backend como fallback...');
    return createAsaasCustomerViaBackend(userData);
  }
};

/**
 * Cria uma assinatura no Asaas
 * Em produção, usa o backend. Em modo de teste, pode conectar diretamente.
 * @param planId ID do plano a ser assinado
 * @param userId ID do usuário no seu sistema
 * @param customerId ID do cliente no Asaas
 */
export const createAsaasSubscription = async (
  planId: string,
  userId: string,
  customerId: string
): Promise<{ subscriptionId: string, redirectUrl: string }> => {
  // Em produção, sempre usar o backend para segurança
  if (config.isProduction) {
    return createAsaasSubscriptionViaBackend(planId, userId, customerId);
  }
  
  try {
    console.log(`Criando assinatura (modo direto): planId=${planId}, userId=${userId}, customerId=${customerId}`);
    
    // Valores de exemplo baseados no ID do plano
    let value = 19.90;
    let planName = 'Plano Básico';
    
    if (planId === 'pro') {
      value = 49.90;
      planName = 'Plano Profissional';
    } else if (planId === 'premium') {
      value = 99.90;
      planName = 'Plano Premium';
    }
    
    // Data de vencimento (próximo mês)
    const today = new Date();
    const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
    const nextDueDate = nextMonth.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    
    // Dados da assinatura
    const subscriptionData = {
      customer: customerId,
      billingType: 'PIX', // Ou outro método: 'CREDIT_CARD', 'BOLETO'
      value: value,
      nextDueDate: nextDueDate,
      cycle: 'MONTHLY',
      description: `Assinatura do ${planName}`,
      externalReference: userId
    };
    
    const response = await asaasDirectClient.post('/subscriptions', subscriptionData);
    console.log('Resposta da criação de assinatura (modo direto):', response.data);
    
    // Para pagamentos via PIX, precisamos criar uma cobrança e pegar o QR code
    const createPaymentResponse = await asaasDirectClient.post('/payments', {
      customer: customerId,
      billingType: 'PIX',
      value: value,
      dueDate: nextDueDate,
      description: `Primeiro pagamento - ${planName}`,
      externalReference: userId
    });
    
    // Gerar o QR code PIX
    const paymentId = createPaymentResponse.data.id;
    const pixResponse = await asaasDirectClient.get(`/payments/${paymentId}/pixQrCode`);
    
    const paymentUrl = pixResponse.data.success ? 
                      `https://sandbox.asaas.com/payment/auth/${paymentId}` : 
                      `https://sandbox.asaas.com/i/${paymentId}`;
    
    return {
      subscriptionId: response.data.id,
      redirectUrl: paymentUrl
    };
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas (modo direto):', error);
    
    // Em caso de erro no modo direto, tentar via backend como fallback
    console.log('Tentando criar assinatura via backend como fallback...');
    return createAsaasSubscriptionViaBackend(planId, userId, customerId);
  }
};

// Funções originais que chamam o backend (renomeadas para referência)
export const createAsaasCustomerViaBackend = async (userData: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
}): Promise<string> => {
  try {
    console.log('Criando/recuperando cliente no Asaas (via backend):', userData);
    
    const endpoint = '/asaas-create-customer';
    console.log('Usando endpoint:', endpoint);
    
    const response = await apiClient.post(endpoint, {
      name: userData.name,
      email: userData.email,
      cpfCnpj: userData.cpfCnpj,
      mobilePhone: userData.mobilePhone,
      userId: localStorage.getItem('userId') // Adicionar userId automaticamente
    });
    
    console.log('Resposta da API de criação de cliente:', response.data);
    
    if (response.data && response.data.customer && response.data.customer.asaasId) {
      return response.data.customer.asaasId;
    } else if (response.data && response.data.customerId) {
      return response.data.customerId;
    }
    
    throw new Error('ID de cliente não recebido');
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
    
    if (error instanceof Error) {
      throw new Error(`Falha ao criar cliente: ${error.message}`);
    }
    
    throw new Error('Falha ao criar cliente no Asaas');
  }
};

export const createAsaasSubscriptionViaBackend = async (
  planId: string,
  userId: string,
  customerId: string
): Promise<{ subscriptionId: string, redirectUrl: string }> => {
  try {
    console.log(`Criando assinatura via backend: planId=${planId}, userId=${userId}, customerId=${customerId}`);
    
    const endpoint = '/asaas-create-subscription';
    console.log('Usando endpoint:', endpoint);
    
    const response = await apiClient.post(endpoint, {
      planId,
      userId,
      customerId
    });
    
    console.log('Resposta da API de criação de assinatura:', response.data);
    
    if (response.data && response.data.redirectUrl) {
      return {
        subscriptionId: response.data.subscriptionId || '',
        redirectUrl: response.data.redirectUrl
      };
    }
    
    throw new Error('URL de redirecionamento não recebida');
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error);
    
    if (error instanceof Error) {
      throw new Error(`Falha ao criar assinatura: ${error.message}`);
    }
    
    throw new Error('Falha ao criar assinatura no Asaas');
  }
}; 