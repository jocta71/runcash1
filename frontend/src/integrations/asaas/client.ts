/**
 * Cliente para integração com Asaas
 */

import axios from 'axios';
import Cookies from 'js-cookie';
import { PlanType } from '@/types/plans';
import { User } from '@/types/user';
import { toast } from '@/utils/toast-helper';
import { getAsaasCheckoutUrl, buildAsaasCheckoutUrl } from '../../utils/asaas-helpers';

/**
 * Cria um cliente no Asaas ou recupera um existente
 * @param userData Dados do usuário (nome, email, cpf/cnpj, telefone)
 */
export const createAsaasCustomer = async (userData: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
}): Promise<string> => {
  try {
    console.log('Criando/recuperando cliente no Asaas:', userData);
    
    const response = await axios.post('/api/asaas-create-customer', {
      name: userData.name,
      email: userData.email,
      cpfCnpj: userData.cpfCnpj,
      mobilePhone: userData.mobilePhone
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
 */
export const createAsaasSubscription = async (
  planId: string,
  userId: string,
  customerId: string
): Promise<{ subscriptionId: string, redirectUrl: string }> => {
  try {
    console.log(`Criando assinatura: planId=${planId}, userId=${userId}, customerId=${customerId}`);
    
    const response = await axios.post('/api/asaas-create-subscription', {
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

// URLs padrão de checkout do Asaas
const DEFAULT_BASIC_CHECKOUT_URL = 'https://sandbox.asaas.com/checkout';
const DEFAULT_PRO_CHECKOUT_URL = 'https://sandbox.asaas.com/checkout';

// IDs dos planos no Asaas
const PLAN_IDS = {
  basic: 'sub_basic',
  pro: 'sub_pro'
};

/**
 * Obtém as URLs de checkout com base nas variáveis de ambiente
 */
export const getCheckoutUrls = () => {
  // Verificar se estamos em modo sandbox
  const isSandbox = import.meta.env.VITE_ASAAS_SANDBOX === 'true';
  
  // Construir URLs baseadas no ambiente
  const baseUrl = isSandbox 
    ? 'https://sandbox.asaas.com/c/' 
    : 'https://www.asaas.com/c/';
  
  const baseUrls = {
    basic: import.meta.env.VITE_ASAAS_BASIC_CHECKOUT_URL || (baseUrl + PLAN_IDS.basic),
    pro: import.meta.env.VITE_ASAAS_PRO_CHECKOUT_URL || (baseUrl + PLAN_IDS.pro)
  };
  
  console.log(`Asaas URLs configuradas (${isSandbox ? 'sandbox' : 'produção'}):`, baseUrls);
  
  return baseUrls;
};

/**
 * Verifica se o usuário está elegível para checkout
 * 
 * @param {Object} user - Objeto do usuário
 * @param {Boolean} isAuthenticated - Status de autenticação
 * @returns {Boolean} - Se o usuário está elegível
 */
export function verifyCheckoutEligibility(user, isAuthenticated) {
  if (!isAuthenticated) {
    toast.error('Você precisa estar autenticado para assinar um plano');
    return false;
  }

  if (!user) {
    toast.error('Dados do usuário não encontrados');
    return false;
  }

  if (!user._id) {
    toast.error('ID do usuário não encontrado');
    return false;
  }

  return true;
}

/**
 * Redireciona o usuário para o checkout do Asaas
 * 
 * @param {Object} options - Opções de redirecionamento
 * @param {String} options.planId - ID do plano (basic, pro)
 * @param {Object} options.user - Objeto do usuário
 * @param {Boolean} options.isAuthenticated - Status de autenticação
 * @returns {Boolean} - Se o redirecionamento foi bem-sucedido
 */
export function redirectToAsaasCheckout({ planId, user, isAuthenticated }) {
  try {
    const userId = user?.id || user?._id;
    
    if (!userId) {
      console.error('ID do usuário não encontrado');
      toast.error('ID do usuário não encontrado');
      return false;
    }

    // Verificar se temos um plano válido
    if (!planId || (planId !== 'basic' && planId !== 'pro')) {
      toast.error('Plano inválido selecionado');
      return false;
    }

    // Obter URL base do checkout
    const baseUrl = getAsaasCheckoutUrl(planId);

    // Construir metadados para o checkout
    const metadata = {
      userId,
      name: user.name || user.displayName || '',
      email: user.email || '',
      plan: planId,
      referral: localStorage.getItem('referral') || ''
    };

    // Construir URL completa do checkout
    const checkoutUrl = buildAsaasCheckoutUrl(baseUrl, metadata);

    // Redirecionar para o checkout
    window.location.href = checkoutUrl;
    return true;
  } catch (error) {
    console.error('Erro ao redirecionar para checkout do Asaas:', error);
    toast.error('Erro ao processar checkout. Por favor, tente novamente.');
    return false;
  }
}

/**
 * Funções para gerenciar assinaturas
 */
export const cancelSubscription = async (subscriptionId: string) => {
  // Implementação da chamada para a API do Asaas para cancelar assinatura
  throw new Error('Função não implementada: cancelar assinatura via API do Asaas');
};

export const getSubscriptionDetails = async (subscriptionId: string) => {
  // Implementação da chamada para a API do Asaas para obter detalhes da assinatura
  throw new Error('Função não implementada: obter detalhes da assinatura via API do Asaas');
}; 