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
 * Interface para respostas da API
 */
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
  details?: any;
  error?: string;
  
  // Campos específicos para respostas de cliente
  customerId?: string;
  id?: string;
  
  // Campos específicos para respostas de assinatura
  subscriptionId?: string;
  paymentId?: string;
  redirectUrl?: string;
  status?: string;
  
  // Objetos completos que podem ser retornados
  subscription?: {
    id: string;
    status?: string;
    payments?: Array<{
      id: string;
      status?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  
  payment?: {
    id: string;
    status?: string;
    [key: string]: any;
  };
}

/**
 * Cria um cliente no Asaas ou recupera um existente
 */
export const createAsaasCustomer = async (userData: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  userId: string;
}): Promise<string> => {
  try {
    console.log('Criando cliente no Asaas:', userData);
    
    const response = await api.post<ApiResponse>('api/asaas-create-customer', {
      name: userData.name,
      email: userData.email,
      cpfCnpj: userData.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: userData.mobilePhone?.replace(/\D/g, '') || '',
      userId: userData.userId,
    });
    
    console.log('Resposta da API de criação de cliente:', response.data);
    
    // Verifica diversos formatos possíveis de resposta
    const customerId = 
      response.data?.customerId || 
      response.data?.id || 
      response.data?.data?.customerId ||
      (response.data?.success && response.data?.id);
      
    if (customerId) {
      console.log('ID do cliente encontrado:', customerId);
      return customerId;
    }
    
    console.error('Falha ao extrair ID do cliente da resposta:', response.data);
    throw new Error('ID de cliente não recebido');
  } catch (error) {
    console.error('Erro ao criar cliente no Asaas:', error);
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
}

/**
 * Interface para dados de criação de assinatura
 */
interface SubscriptionRequest {
  planId: string;
  userId: string;
  customerId: string;
  paymentMethod: string;
  creditCard?: any;
  creditCardHolderInfo?: any;
  cpfCnpj?: string;
}

/**
 * Cria uma assinatura no Asaas
 */
export const createAsaasSubscription = async (
  subscriptionData: SubscriptionRequest
): Promise<SubscriptionResponse> => {
  try {
    console.log('Criando assinatura no Asaas:', subscriptionData);

    const response = await api.post<ApiResponse<SubscriptionResponse>>(
      'api/asaas-create-subscription',
      subscriptionData
    );

    console.log('Resposta da API de criação de assinatura:', response.data);
    
    // Busca o ID da assinatura nos diferentes possíveis formatos de resposta
    let subscriptionId = response.data?.data?.subscriptionId || 
                         response.data?.subscriptionId ||
                         response.data?.subscription?.id;
                        
    let paymentId = response.data?.data?.paymentId || 
                   response.data?.paymentId ||
                   response.data?.payment?.id ||
                   (response.data?.subscription?.payments && response.data?.subscription?.payments[0]?.id);
                   
    let redirectUrl = response.data?.data?.redirectUrl || response.data?.redirectUrl;
    let status = response.data?.data?.status || response.data?.status || response.data?.subscription?.status;
    
    console.log('ID da assinatura encontrado:', subscriptionId);
    console.log('ID do pagamento encontrado:', paymentId);
    
    if (!subscriptionId) {
      throw new Error('ID de assinatura não recebido');
    }

    return {
      subscriptionId,
      paymentId: paymentId || '',
      redirectUrl: redirectUrl || '',
      status: status || ''
    };
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error);
    throw new Error(`Falha ao criar assinatura no Asaas: ${(error as Error).message}`);
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
  qrCode: {
    encodedImage: string;
    payload: string;
    expirationDate?: string;
  };
  payment: any;
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
    
    return {
      qrCodeImage: response.data.qrCode.encodedImage,
      qrCodeText: response.data.qrCode.payload,
      expirationDate: response.data.qrCode.expirationDate
    };
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
      const payment = await findAsaasPayment(paymentId, true);
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
        onError(new Error(`Pagamento não concluído: ${payment.status}`));
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      // Não parar o polling em caso de erro temporário
    }
  };
  
  // Iniciar verificação periódica
  intervalId = window.setInterval(checkStatus, interval);
  
  // Definir tempo máximo
  timeoutId = window.setTimeout(() => {
    stopChecking();
    onError(new Error('Tempo limite excedido para verificação de pagamento'));
  }, timeout);
  
  // Executar primeira verificação imediatamente
  checkStatus();
  
  // Retornar função para cancelar o monitoramento
  return stopChecking;
};