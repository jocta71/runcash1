import axios from 'axios';

// Tipos para a integração com Hubla
export interface HublaCustomerData {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  additionalEmails?: string[];
  externalReference?: string;
}

export interface HublaSubscriptionData {
  customerId: string;
  planId: string;
  value: number;
  cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';
  nextDueDate: string;
  description?: string;
  externalReference?: string;
  callbackUrl?: string;
}

/**
 * Cria ou recupera um cliente na Hubla
 * @param userData Dados do usuário necessários para criar um cliente
 * @returns O ID do cliente na Hubla
 */
export async function createHublaCustomer(userData: HublaCustomerData): Promise<string> {
  try {
    console.log('Iniciando criação de cliente no Hubla:', userData.name);

    const response = await axios.post('/api/hubla-create-customer', userData);

    if (response.status === 200 || response.status === 201) {
      console.log('Cliente criado/recuperado com sucesso no Hubla:', response.data.customerId);
      return response.data.customerId;
    } else {
      throw new Error(`Erro ao criar cliente: ${response.status}`);
    }
  } catch (error) {
    console.error('Erro ao criar cliente no Hubla:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      console.error('Detalhes do erro:', error.response.data);
      throw new Error(error.response.data.error || 'Falha na criação do cliente Hubla');
    }
    
    throw new Error('Erro ao conectar-se com o servidor para criar cliente Hubla');
  }
}

/**
 * Cria uma assinatura na Hubla
 * @param subscriptionData Dados da assinatura a ser criada
 * @returns Objeto contendo ID da assinatura e URL para pagamento
 */
export async function createHublaSubscription(
  subscriptionData: HublaSubscriptionData
): Promise<{ subscriptionId: string; redirectUrl: string }> {
  try {
    console.log('Iniciando criação de assinatura no Hubla:', {
      customerId: subscriptionData.customerId,
      planId: subscriptionData.planId,
      value: subscriptionData.value,
      cycle: subscriptionData.cycle
    });

    const response = await axios.post('/api/hubla-create-subscription', subscriptionData);

    if (response.status === 200 || response.status === 201) {
      console.log('Assinatura criada com sucesso no Hubla:', response.data);
      
      if (!response.data.redirectUrl) {
        throw new Error('URL de pagamento não encontrada na resposta');
      }

      return {
        subscriptionId: response.data.subscriptionId,
        redirectUrl: response.data.redirectUrl
      };
    } else {
      throw new Error(`Erro ao criar assinatura: ${response.status}`);
    }
  } catch (error) {
    console.error('Erro ao criar assinatura no Hubla:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      console.error('Detalhes do erro:', error.response.data);
      throw new Error(error.response.data.error || 'Falha na criação da assinatura Hubla');
    }
    
    throw new Error('Erro ao conectar-se com o servidor para criar assinatura Hubla');
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