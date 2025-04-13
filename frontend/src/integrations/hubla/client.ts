import axios from 'axios';

interface Customer {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
}

interface SubscriptionData {
  planId: string;
  customerId: string;
  value: number;
  cycle: string; // MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY
  description?: string;
  nextDueDate: string; // yyyy-MM-dd
  externalReference?: string;
}

/**
 * Cria ou recupera um cliente na Hubla
 * @param userData Dados do usuário necessários para criar um cliente
 * @returns O ID do cliente na Hubla
 */
export async function createHublaCustomer(userData: Customer): Promise<string> {
  try {
    console.log('Criando cliente na Hubla:', userData.name);
    const response = await axios.post('/api/hubla-create-customer', userData);
    
    if (response.status === 200 && response.data.customerId) {
      console.log('Cliente criado/recuperado na Hubla com sucesso:', response.data.customerId);
      return response.data.customerId;
    } else {
      console.error('Resposta inesperada ao criar cliente na Hubla:', response.data);
      throw new Error('Falha ao criar cliente na Hubla: resposta inesperada');
    }
  } catch (error: any) {
    console.error('Erro ao criar cliente na Hubla:', error.message);
    
    if (error.response) {
      // Erro da API
      const errorMessage = error.response.data?.error || 'Erro desconhecido da API';
      throw new Error(`Erro na criação de cliente: ${errorMessage}`);
    } else if (error.request) {
      // Sem resposta
      throw new Error('Não foi possível conectar ao servidor para criar o cliente');
    } else {
      // Erro geral
      throw error;
    }
  }
}

/**
 * Cria uma assinatura na Hubla
 * @param subscriptionData Dados da assinatura a ser criada
 * @returns Objeto contendo ID da assinatura e URL para pagamento
 */
export async function createHublaSubscription(subscriptionData: SubscriptionData): Promise<{
  subscriptionId: string;
  redirectUrl: string;
}> {
  try {
    console.log('Criando assinatura na Hubla:', {
      customerId: subscriptionData.customerId,
      planId: subscriptionData.planId,
      value: subscriptionData.value
    });
    
    const response = await axios.post('/api/hubla-create-subscription', subscriptionData);
    
    if (response.status === 200 && response.data.subscriptionId && response.data.redirectUrl) {
      console.log('Assinatura criada na Hubla com sucesso:', response.data.subscriptionId);
      return {
        subscriptionId: response.data.subscriptionId,
        redirectUrl: response.data.redirectUrl
      };
    } else {
      console.error('Resposta inesperada ao criar assinatura na Hubla:', response.data);
      throw new Error('Falha ao criar assinatura: resposta inesperada');
    }
  } catch (error: any) {
    console.error('Erro ao criar assinatura na Hubla:', error.message);
    
    if (error.response) {
      // Erro da API
      const errorMessage = error.response.data?.error || 'Erro desconhecido da API';
      throw new Error(`Erro na criação da assinatura: ${errorMessage}`);
    } else if (error.request) {
      // Sem resposta
      throw new Error('Não foi possível conectar ao servidor para criar a assinatura');
    } else {
      // Erro geral
      throw error;
    }
  }
}

/**
 * Busca detalhes de uma assinatura na Hubla
 * @param subscriptionId ID da assinatura na Hubla
 * @returns Detalhes da assinatura
 */
export async function getHublaSubscriptionDetails(subscriptionId: string): Promise<any> {
  try {
    console.log('Buscando detalhes da assinatura na Hubla:', subscriptionId);
    
    const response = await axios.get(`/api/hubla-subscription-details?id=${subscriptionId}`);
    
    if (response.status === 200 && response.data) {
      console.log('Detalhes da assinatura recuperados com sucesso');
      return response.data;
    } else {
      console.error('Resposta inesperada ao buscar detalhes da assinatura:', response.data);
      throw new Error('Falha ao buscar detalhes da assinatura: resposta inesperada');
    }
  } catch (error: any) {
    console.error('Erro ao buscar detalhes da assinatura na Hubla:', error.message);
    
    if (error.response) {
      // Erro da API
      const errorMessage = error.response.data?.error || 'Erro desconhecido da API';
      throw new Error(`Erro ao buscar detalhes da assinatura: ${errorMessage}`);
    } else if (error.request) {
      // Sem resposta
      throw new Error('Não foi possível conectar ao servidor para buscar detalhes da assinatura');
    } else {
      // Erro geral
      throw error;
    }
  }
}

/**
 * Cancela uma assinatura na Hubla
 * @param subscriptionId ID da assinatura na Hubla
 * @returns Confirmação do cancelamento
 */
export async function cancelHublaSubscription(subscriptionId: string): Promise<boolean> {
  try {
    console.log('Cancelando assinatura na Hubla:', subscriptionId);
    
    const response = await axios.post('/api/hubla-cancel-subscription', { subscriptionId });
    
    if (response.status === 200 && response.data.success) {
      console.log('Assinatura cancelada com sucesso');
      return true;
    } else {
      console.error('Resposta inesperada ao cancelar assinatura:', response.data);
      throw new Error('Falha ao cancelar assinatura: resposta inesperada');
    }
  } catch (error: any) {
    console.error('Erro ao cancelar assinatura na Hubla:', error.message);
    
    if (error.response) {
      // Erro da API
      const errorMessage = error.response.data?.error || 'Erro desconhecido da API';
      throw new Error(`Erro ao cancelar assinatura: ${errorMessage}`);
    } else if (error.request) {
      // Sem resposta
      throw new Error('Não foi possível conectar ao servidor para cancelar a assinatura');
    } else {
      // Erro geral
      throw error;
    }
  }
} 