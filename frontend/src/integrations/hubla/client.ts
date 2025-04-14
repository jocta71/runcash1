/**
 * Cliente para integração com Hubla
 */
import Cookies from 'js-cookie';
import { PlanType } from '@/types/plans';
import { User } from '@/types/user';

// URLs padrão de checkout
const DEFAULT_BASIC_CHECKOUT_URL = 'https://pay.hub.la/sD6k3KyqLtK7Kyyyl5YA';
const DEFAULT_PRO_CHECKOUT_URL = 'https://pay.hub.la/sD6k3KyqLtK7Kyyyl5YA';

// URLs de checkout para ambiente sandbox (quando disponível)
const SANDBOX_BASIC_CHECKOUT_URL = 'https://pay.sandbox.hub.la/sD6k3KyqLtK7Kyyyl5YA';
const SANDBOX_PRO_CHECKOUT_URL = 'https://pay.sandbox.hub.la/sD6k3KyqLtK7Kyyyl5YA';

// Obter as URLs de checkout com base nas variáveis de ambiente ou usar as padrão
export const getCheckoutUrls = () => {
  // Verificar se estamos em modo sandbox
  const isSandbox = import.meta.env.VITE_HUBLA_SANDBOX === 'true';
  
  // Usar URLs específicas para ambiente sandbox ou produção
  const baseUrls = isSandbox ? {
    basic: SANDBOX_BASIC_CHECKOUT_URL,
    pro: SANDBOX_PRO_CHECKOUT_URL
  } : {
    basic: import.meta.env.VITE_HUBLA_BASIC_CHECKOUT_URL || DEFAULT_BASIC_CHECKOUT_URL,
    pro: import.meta.env.VITE_HUBLA_PRO_CHECKOUT_URL || DEFAULT_PRO_CHECKOUT_URL
  };
  
  console.log(`Hubla URLs configuradas (${isSandbox ? 'sandbox' : 'produção'}):`, baseUrls);
  
  return baseUrls;
};

// Verificar se o usuário está elegível para checkout
export const verifyCheckoutEligibility = (user: User | null) => {
  // Log para depuração
  console.log('Verificando elegibilidade para checkout com usuário:', user);
  
  if (!user) {
    console.error('Usuário não fornecido para verificação de elegibilidade');
    return {
      isEligible: false,
      message: 'Usuário não autenticado. Por favor, faça login para continuar.'
    };
  }
  
  // Verificar se o usuário tem ID (qualquer formato)
  const userId = user.id || (user as any)._id;
  if (!userId) {
    console.error('Usuário sem ID válido:', user);
    return {
      isEligible: false,
      message: 'ID de usuário não encontrado. Por favor, faça login novamente.'
    };
  }
  
  // Verificar outras condições de elegibilidade se necessário
  // ...
  
  console.log('Usuário elegível para checkout com ID:', userId);
  return {
    isEligible: true,
    message: 'Usuário elegível para checkout'
  };
};

// Função para redirecionar o usuário para o checkout da Hubla
export const redirectToHublaCheckout = (planId: string, userId: string) => {
  console.log(`Preparando redirecionamento para checkout com planId=${planId} e userId=${userId}`);
  
  // Validar entradas
  if (!planId || !userId) {
    console.error('Dados inválidos para checkout:', { planId, userId });
    throw new Error('Dados inválidos para checkout. ID do plano e ID do usuário são obrigatórios.');
  }
  
  try {
    // Obter URLs de checkout 
    const checkoutUrls = getCheckoutUrls();
    
    // Determinar a URL base baseada no plano
    let baseUrl;
    switch (planId) {
      case 'basic':
        baseUrl = checkoutUrls.basic;
        break;
      case 'pro':
        baseUrl = checkoutUrls.pro;
        break;
      default:
        console.error('Plano não reconhecido:', planId);
        throw new Error(`Plano não reconhecido: ${planId}`);
    }
    
    // Construir a URL completa com metadados
    // Importante: Usamos metadata[userId] e metadata[planId] conforme confirmado pelo suporte da Hubla
    const checkoutUrl = `${baseUrl}?metadata[userId]=${encodeURIComponent(userId)}&metadata[planId]=${encodeURIComponent(planId)}`;
    
    console.log('URL de checkout gerada:', checkoutUrl);
    
    // Retornar a URL construída
    return checkoutUrl;
  } catch (error) {
    console.error('Erro ao gerar URL de checkout:', error);
    throw new Error('Não foi possível gerar a URL de checkout. Por favor, tente novamente.');
  }
};

// Funções adicionais para gerenciar assinaturas
export const cancelSubscription = async (subscriptionId: string) => {
  // Implementação futura para cancelar assinatura via API
  throw new Error('Função não implementada');
};

export const getSubscriptionDetails = async (subscriptionId: string) => {
  // Implementação futura para obter detalhes da assinatura via API
  throw new Error('Função não implementada');
}; 