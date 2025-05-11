/**
 * Cliente para integração com Asaas
 */

import axios, { AxiosError } from 'axios';

// Configuração base do axios
const api = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para tratamento de erros
api.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    console.error('Erro na requisição:', {
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method
      }
    });
    return Promise.reject(error);
  }
);

/**
 * Interface para resposta padrão da API
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Cria um cliente no Asaas ou recupera um existente
 * @param userData Dados do usuário (nome, email, cpf/cnpj, telefone)
 */
export const createAsaasCustomer = async (userData: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  userId: string;
}): Promise<string> => {
  try {
    console.log('Criando/recuperando cliente no Asaas:', userData);
    
    const response = await api.post<ApiResponse<{ customerId: string }>>('api/asaas-create-customer', {
      name: userData.name,
      email: userData.email,
      cpfCnpj: userData.cpfCnpj,
      phone: userData.mobilePhone,
      userId: userData.userId
    });
    
    console.log('Resposta da API de criação de cliente:', response.data);
    
    if (response.data?.data?.customerId) {
      return response.data.data.customerId;
    }
    
    throw new Error('ID de cliente não recebido');
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
    
    if (error instanceof AxiosError) {
      throw new Error(`Falha ao criar cliente: ${error.response?.data?.error || error.message}`);
    }
    
    throw new Error('Falha ao criar cliente no Asaas');
  }
};

/**
 * Interface para resposta de criação de assinatura
 */
export interface SubscriptionResponse {
  subscriptionId: string;
  paymentId: string;
  redirectUrl?: string;
  status: string;
  qrCode?: {
    encodedImage: string;
    payload: string;
    expirationDate?: string;
  };
}

/**
 * Cria uma assinatura no Asaas
 * @param planId ID do plano a ser assinado
 * @param userId ID do usuário no seu sistema
 * @param customerId ID do cliente no Asaas
 * @param paymentMethod Método de pagamento (PIX, CREDIT_CARD, etc)
 * @param creditCard Dados do cartão de crédito (opcional)
 * @param creditCardHolderInfo Dados do titular do cartão (opcional)
 * @param cpfCnpj CPF/CNPJ do cliente (opcional) - Será atualizado antes de criar a assinatura
 */
export const createAsaasSubscription = async (
  planId: string,
  userId: string,
  customerId: string,
  paymentMethod: string = 'PIX',
  creditCard?: any,
  creditCardHolderInfo?: any,
  cpfCnpj?: string
): Promise<SubscriptionResponse> => {
  try {
    console.log(`Criando assinatura: planId=${planId}, userId=${userId}, customerId=${customerId}`);
    
    // Montar payload com todos os dados necessários
    const payload: any = {
      planId,
      userId,
      customerId,
      billingType: paymentMethod, // CREDIT_CARD, PIX, etc
      cycle: 'MONTHLY',
      value: creditCard?.value || 0,
      description: `Assinatura RunCash - Plano ${planId}`
    };

    // Adicionar CPF/CNPJ se fornecido para atualização
    if (cpfCnpj) {
      payload.cpfCnpj = cpfCnpj;
      console.log('CPF/CNPJ fornecido para atualização:', cpfCnpj);
    }
    
    // Adicionar dados de cartão se for pagamento com cartão
    if (paymentMethod === 'CREDIT_CARD' && creditCard) {
      payload.holderName = creditCard.holderName;
      payload.cardNumber = creditCard.number;
      payload.expiryMonth = creditCard.expiryMonth;
      payload.expiryYear = creditCard.expiryYear;
      payload.ccv = creditCard.ccv;
      
      // Adicionar dados do titular se fornecidos
      if (creditCardHolderInfo) {
        payload.holderEmail = creditCardHolderInfo.email;
        payload.holderCpfCnpj = creditCardHolderInfo.cpfCnpj;
        payload.holderPostalCode = creditCardHolderInfo.postalCode;
        payload.holderAddressNumber = creditCardHolderInfo.addressNumber;
        payload.holderPhone = creditCardHolderInfo.phone;
      }
    }
    
    console.log('Enviando payload para criação de assinatura:', {
      ...payload,
      cardNumber: payload.cardNumber ? `****${payload.cardNumber.slice(-4)}` : undefined,
      ccv: payload.ccv ? '***' : undefined,
      holderCpfCnpj: payload.holderCpfCnpj ? `****${payload.holderCpfCnpj.slice(-4)}` : undefined,
      cpfCnpj: payload.cpfCnpj ? `****${payload.cpfCnpj.slice(-4)}` : undefined
    });
    
    const response = await api.post<ApiResponse<SubscriptionResponse>>('api/asaas-create-subscription', payload);
    
    console.log('Resposta da API de criação de assinatura:', response.data);
    
    if (!response.data?.data?.subscriptionId) {
      throw new Error('ID de assinatura não recebido');
    }
    
    return {
      subscriptionId: response.data.data.subscriptionId,
      paymentId: response.data.data.paymentId || '',
      redirectUrl: response.data.data.redirectUrl,
      status: response.data.data.status || 'PENDING',
      qrCode: response.data.data.qrCode
    };
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error);
    
    if (error instanceof AxiosError) {
      console.error('Detalhes do erro:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Falha ao criar assinatura: ${error.response?.data?.error || error.message}`);
    }
    
    throw new Error('Falha ao criar assinatura no Asaas');
  }
};

/**
 * Interface para resposta de pagamento
 */
interface PaymentResponse {
  success: boolean;
  payment: any;
}

/**
 * Busca detalhes de um pagamento no Asaas
 * @param paymentId ID do pagamento no Asaas
 * @param force Se true, força atualização ignorando cache
 */
export const findAsaasPayment = async (paymentId: string, force: boolean = false): Promise<any> => {
  try {
    console.log(`Buscando pagamento: paymentId=${paymentId}${force ? ' (forçado)' : ''}`);
    
    // Adicionar parâmetro de cache buster quando força atualização
    const cacheBuster = force ? `&_t=${Date.now()}` : '';
    const response = await api.get<PaymentResponse>(`api/asaas-find-payment?paymentId=${paymentId}${cacheBuster}`);
    
    console.log('Resposta da API de busca de pagamento:', response.data);
    
    if (!response.data?.success) {
      throw new Error('Falha ao buscar pagamento');
    }
    
    return response.data.payment;
  } catch (error) {
    console.error('Erro ao buscar pagamento no Asaas:', error);
    
    if (error instanceof AxiosError) {
      throw new Error(`Falha ao buscar pagamento: ${error.response?.data?.error || error.message}`);
    }
    
    throw new Error('Falha ao buscar pagamento no Asaas');
  }
};

/**
 * Interface para resposta do QR code PIX
 */
interface PixQrCodeResponse {
  success: boolean;
  data?: {
    qrCode: {
      encodedImage: string;
      payload: string;
      expirationDate?: string;
    };
  };
  qrCode?: {
    encodedImage: string;
    payload: string;
    expirationDate?: string;
  };
  payment?: any;
}

/**
 * Busca QR code PIX para um pagamento no Asaas
 * @param paymentId ID do pagamento no Asaas
 */
export const getAsaasPixQrCode = async (paymentId: string): Promise<{
  qrCodeImage: string;
  qrCodeText: string;
  expirationDate?: string;
}> => {
  try {
    console.log(`Buscando QR code PIX: paymentId=${paymentId}`);
    
    const response = await api.get<PixQrCodeResponse>(`api/asaas-pix-qrcode?paymentId=${paymentId}`);
    
    console.log('Resposta da API de QR code PIX:', response.data);
    
    if (!response.data?.success) {
      throw new Error('Falha ao buscar QR code PIX');
    }
    
    // Verificação da estrutura da resposta para lidar com diferentes formatos
    // Verificamos se a resposta está no formato completo data.data.qrCode ou no formato direto data.qrCode
    const qrCodeData = response.data.data?.qrCode || response.data.qrCode;
    
    if (!qrCodeData) {
      console.error('QR code PIX: estrutura da resposta inválida:', response.data);
      throw new Error('Estrutura da resposta de QR code inválida');
    }
    
    // Verificando se os dados estão presentes
    if (!qrCodeData.encodedImage) {
      console.warn('QR code PIX: encodedImage não encontrado na resposta');
    }
    
    if (!qrCodeData.payload) {
      console.warn('QR code PIX: payload não encontrado na resposta');
    }
    
    const result = {
      qrCodeImage: qrCodeData.encodedImage || '',
      qrCodeText: qrCodeData.payload || '',
      expirationDate: qrCodeData.expirationDate
    };
    
    console.log('Dados de QR code PIX formatados:', {
      qrCodeImage: result.qrCodeImage ? `${result.qrCodeImage.substring(0, 20)}... (${result.qrCodeImage.length} chars)` : 'undefined',
      qrCodeText: result.qrCodeText ? `${result.qrCodeText.substring(0, 20)}... (${result.qrCodeText.length} chars)` : 'undefined',
      expirationDate: result.expirationDate
    });
    
    return result;
  } catch (error) {
    console.error('Erro ao buscar QR code PIX no Asaas:', error);
    
    if (error instanceof AxiosError) {
      throw new Error(`Falha ao buscar QR code PIX: ${error.response?.data?.error || error.message}`);
    }
    
    throw new Error('Falha ao buscar QR code PIX no Asaas');
  }
};

/**
 * Monitora o status de um pagamento com polling periódico
 * @param paymentId ID do pagamento no Asaas
 * @param onSuccess Callback para quando o pagamento for confirmado
 * @param onError Callback para quando ocorrer um erro
 * @param interval Intervalo em ms entre as verificações (padrão: 5000ms)
 * @param timeout Tempo máximo em ms para monitorar (padrão: 10 minutos)
 * @returns Função para cancelar o monitoramento
 */
export const checkPaymentStatus = (
  paymentId: string,
  onSuccess: (payment: any) => void,
  onError: (error: Error) => void,
  interval: number = 5000,
  timeout: number = 10 * 60 * 1000
): (() => void) => {
  let timeoutId: number | null = null;
  let intervalId: number | null = null;
  const startTime = Date.now();
  
  const stopChecking = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  const checkStatus = async () => {
    try {
      if (Date.now() - startTime > timeout) {
        stopChecking();
        onError(new Error('Tempo limite excedido para verificação de pagamento'));
        return;
      }
      
      console.log(`Verificando status do pagamento ${paymentId}...`);
      const payment = await findAsaasPayment(paymentId);
      console.log(`Status atual do pagamento: ${payment.status}`, payment);
      
      // Verificar se o pagamento foi confirmado (usando statusList mais completa)
      if (['CONFIRMED', 'RECEIVED', 'AVAILABLE', 'BILLING_AVAILABLE'].includes(payment.status)) {
        console.log(`Pagamento ${paymentId} confirmado!`);
        stopChecking();
        onSuccess(payment);
      } 
      // Verificar se o pagamento teve problema
      else if (['REFUNDED', 'REFUND_REQUESTED', 'OVERDUE', 'CANCELED'].includes(payment.status)) {
        console.log(`Pagamento ${paymentId} com problema: ${payment.status}`);
        stopChecking();
        onError(new Error(`Pagamento ${payment.status}: ${payment.status === 'OVERDUE' ? 'Expirado' : 'Cancelado ou reembolsado'}`));
      }
      // Continua verificando para outros status (PENDING, RECEIVED_IN_CASH...)
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error('Erro desconhecido ao verificar pagamento'));
      }
    }
  };
  
  // Atrasar a primeira verificação em 3 segundos para dar tempo ao Asaas processar
  console.log(`Agendando verificação do pagamento ${paymentId} para iniciar em 3 segundos...`);
  setTimeout(() => {
    // Inicia o polling após o atraso inicial
    console.log(`Iniciando verificação periódica do pagamento ${paymentId}...`);
    checkStatus(); // Verificação inicial
    
    intervalId = window.setInterval(checkStatus, interval);
    
    // Define o timeout
    timeoutId = window.setTimeout(() => {
      stopChecking();
      onError(new Error('Tempo limite excedido para verificação de pagamento'));
    }, timeout);
  }, 3000);
  
  // Retorna função para cancelar o monitoramento
  return stopChecking;
};

/**
 * Busca detalhes de uma assinatura no Asaas
 * @param subscriptionId ID da assinatura no Asaas
 */
export const findAsaasSubscription = async (subscriptionId: string): Promise<any> => {
  try {
    console.log(`Buscando assinatura: subscriptionId=${subscriptionId}`);
    
    const response = await api.get<ApiResponse<any>>(`api/asaas-find-subscription?subscriptionId=${subscriptionId}`);
    
    console.log('Resposta da API de busca de assinatura:', response.data);
    
    if (!response.data?.success) {
      throw new Error('Falha ao buscar assinatura');
    }
    
    return {
      subscription: response.data.subscription,
      payments: response.data.payments || []
    };
  } catch (error) {
    console.error('Erro ao buscar assinatura no Asaas:', error);
    
    if (error instanceof AxiosError) {
      throw new Error(`Falha ao buscar assinatura: ${error.response?.data?.error || error.message}`);
    }
    
    throw new Error('Falha ao buscar assinatura no Asaas');
  }
};

/**
 * Cancela uma assinatura no Asaas
 * @param subscriptionId ID da assinatura no Asaas
 */
export const cancelAsaasSubscription = async (subscriptionId: string): Promise<any> => {
  try {
    console.log(`Cancelando assinatura: subscriptionId=${subscriptionId}`);
    
    const response = await api.post<ApiResponse<any>>('api/asaas-cancel-subscription', {
      subscriptionId
    });
    
    console.log('Resposta da API de cancelamento de assinatura:', response.data);
    
    if (!response.data?.success) {
      throw new Error('Falha ao cancelar assinatura');
    }
    
    return {
      success: true,
      message: response.data.message,
      details: response.data.details
    };
  } catch (error) {
    console.error('Erro ao cancelar assinatura no Asaas:', error);
    
    if (error instanceof AxiosError) {
      throw new Error(`Falha ao cancelar assinatura: ${error.response?.data?.error || error.message}`);
    }
    
    throw new Error('Falha ao cancelar assinatura no Asaas');
  }
};

/**
 * Busca detalhes de um cliente no Asaas
 * @param customerId ID do cliente no Asaas
 * @param cpfCnpj CPF/CNPJ do cliente (alternativa ao ID)
 * @param email Email do cliente (alternativa ao ID)
 */
export const findAsaasCustomer = async (
  params: { customerId?: string; cpfCnpj?: string; email?: string; }
): Promise<any> => {
  try {
    const { customerId, cpfCnpj, email } = params;
    
    if (!customerId && !cpfCnpj && !email) {
      throw new Error('É necessário informar customerId, cpfCnpj ou email');
    }
    
    console.log(`Buscando cliente: ${customerId || cpfCnpj || email}`);
    
    let queryParams = '';
    if (customerId) {
      queryParams = `customerId=${customerId}`;
    } else if (cpfCnpj) {
      queryParams = `cpfCnpj=${cpfCnpj}`;
    } else if (email) {
      queryParams = `email=${encodeURIComponent(email)}`;
    }
    
    const response = await api.get<ApiResponse<any>>(`api/asaas-find-customer?${queryParams}`);
    
    console.log('Resposta da API de busca de cliente:', response.data);
    
    if (!response.data?.success) {
      throw new Error('Falha ao buscar cliente');
    }
    
    return {
      customer: response.data.customer,
      subscriptions: response.data.subscriptions || []
    };
  } catch (error) {
    console.error('Erro ao buscar cliente no Asaas:', error);
    
    if (error instanceof AxiosError) {
      throw new Error(`Falha ao buscar cliente: ${error.response?.data?.error || error.message}`);
    }
    
    throw new Error('Falha ao buscar cliente no Asaas');
  }
}; 