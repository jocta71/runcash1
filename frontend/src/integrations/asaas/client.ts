/**
 * Cliente para integração com Asaas
 */

import axios from 'axios';

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
    
    const response = await axios.post('/api/asaas-create-customer', {
      name: userData.name,
      email: userData.email,
      cpfCnpj: userData.cpfCnpj,
      phone: userData.mobilePhone,
      userId: userData.userId
    });
    
    console.log('Resposta da API de criação de cliente:', response.data);
    
    if (response.data && response.data.customerId) {
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

/**
 * Cria uma assinatura no Asaas
 * @param planId ID do plano a ser assinado
 * @param userId ID do usuário no seu sistema
 * @param customerId ID do cliente no Asaas
 * @param paymentMethod Método de pagamento (PIX, CREDIT_CARD, etc)
 */
export const createAsaasSubscription = async (
  planId: string,
  userId: string,
  customerId: string,
  paymentMethod: string = 'PIX',
  creditCard?: any,
  creditCardHolderInfo?: any
): Promise<{ subscriptionId: string, paymentId: string, redirectUrl?: string, status: string }> => {
  try {
    console.log(`Criando assinatura: planId=${planId}, userId=${userId}, customerId=${customerId}`);
    
    const response = await axios.post('/api/asaas-create-subscription', {
      planId,
      userId,
      customerId,
      paymentMethod,
      creditCard,
      creditCardHolderInfo
    });
    
    console.log('Resposta da API de criação de assinatura:', response.data);
    
    if (!response.data || !response.data.subscriptionId) {
      throw new Error('ID de assinatura não recebido');
    }
    
    return {
      subscriptionId: response.data.subscriptionId,
      paymentId: response.data.paymentId || '',
      redirectUrl: response.data.redirectUrl,
      status: response.data.status || 'PENDING'
    };
  } catch (error) {
    console.error('Erro ao criar assinatura no Asaas:', error);
    
    if (error instanceof Error) {
      throw new Error(`Falha ao criar assinatura: ${error.message}`);
    }
    
    throw new Error('Falha ao criar assinatura no Asaas');
  }
};

/**
 * Busca detalhes de um pagamento no Asaas
 * @param paymentId ID do pagamento no Asaas
 */
export const findAsaasPayment = async (paymentId: string): Promise<any> => {
  try {
    console.log(`Buscando pagamento: paymentId=${paymentId}`);
    
    const response = await axios.get(`/api/asaas-find-payment?paymentId=${paymentId}`);
    
    console.log('Resposta da API de busca de pagamento:', response.data);
    
    if (!response.data || !response.data.success) {
      throw new Error('Falha ao buscar pagamento');
    }
    
    return response.data.payment;
  } catch (error) {
    console.error('Erro ao buscar pagamento no Asaas:', error);
    
    if (error instanceof Error) {
      throw new Error(`Falha ao buscar pagamento: ${error.message}`);
    }
    
    throw new Error('Falha ao buscar pagamento no Asaas');
  }
};

/**
 * Busca QR code PIX para um pagamento no Asaas
 * @param paymentId ID do pagamento no Asaas
 */
export const getAsaasPixQrCode = async (paymentId: string): Promise<{
  qrCodeImage: string,
  qrCodeText: string,
  expirationDate?: string
}> => {
  try {
    console.log(`Buscando QR code PIX: paymentId=${paymentId}`);
    
    const response = await axios.get(`/api/asaas-pix-qrcode?paymentId=${paymentId}`);
    
    console.log('Resposta da API de QR code PIX:', response.data);
    
    if (!response.data || !response.data.success) {
      throw new Error('Falha ao buscar QR code PIX');
    }
    
    return {
      qrCodeImage: response.data.qrCodeImage,
      qrCodeText: response.data.qrCodeText,
      expirationDate: response.data.expirationDate
    };
  } catch (error) {
    console.error('Erro ao buscar QR code PIX no Asaas:', error);
    
    if (error instanceof Error) {
      throw new Error(`Falha ao buscar QR code PIX: ${error.message}`);
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
  let startTime = Date.now();
  
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
      
      const payment = await findAsaasPayment(paymentId);
      
      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        stopChecking();
        onSuccess(payment);
      } else if (payment.status === 'REFUNDED' || payment.status === 'REFUND_REQUESTED' || 
                payment.status === 'OVERDUE' || payment.status === 'CANCELED') {
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
  
  // Inicia o polling
  intervalId = window.setInterval(checkStatus, interval);
  
  // Define o timeout
  timeoutId = window.setTimeout(() => {
    stopChecking();
    onError(new Error('Tempo limite excedido para verificação de pagamento'));
  }, timeout);
  
  // Executa uma verificação imediata
  checkStatus();
  
  // Retorna função para cancelar o monitoramento
  return stopChecking;
}; 