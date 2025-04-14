/**
 * Cliente para integração com Hubla
 */

// Links de pagamento da Hubla (configurados no painel)
// Estas constantes servem como fallback caso as variáveis de ambiente não estejam definidas
const DEFAULT_CHECKOUT_URLS: Record<string, string> = {
  basic: 'https://pay.hub.la/sD6k3KyqLtK7Kyyyl5YA',
  pro: 'https://pay.hub.la/5dYVW0YLLn8qC3dPQDFf'
};

// Função para obter os URLs de checkout, priorizando variáveis de ambiente
const getCheckoutUrls = (): Record<string, string> => {
  // Verificar se as variáveis de ambiente estão definidas
  const basicUrl = process.env.NEXT_PUBLIC_HUBLA_CHECKOUT_URL_BASIC;
  const proUrl = process.env.NEXT_PUBLIC_HUBLA_CHECKOUT_URL_PRO;
  
  // Verificar se estamos em modo sandbox
  const isSandbox = process.env.NEXT_PUBLIC_HUBLA_SANDBOX_MODE === 'true';
  
  // Se estamos em modo sandbox, usar URLs de sandbox se disponíveis
  if (isSandbox) {
    const sandboxBasicUrl = process.env.NEXT_PUBLIC_HUBLA_SANDBOX_URL_BASIC;
    const sandboxProUrl = process.env.NEXT_PUBLIC_HUBLA_SANDBOX_URL_PRO;
    
    return {
      basic: sandboxBasicUrl || basicUrl || DEFAULT_CHECKOUT_URLS.basic,
      pro: sandboxProUrl || proUrl || DEFAULT_CHECKOUT_URLS.pro
    };
  }
  
  // Se não estamos em modo sandbox, usar URLs de produção se disponíveis
  return {
    basic: basicUrl || DEFAULT_CHECKOUT_URLS.basic,
    pro: proUrl || DEFAULT_CHECKOUT_URLS.pro
  };
};

// Obter URLs de checkout
const HUBLA_CHECKOUT_URLS = getCheckoutUrls();

/**
 * Redireciona para checkout da Hubla com metadados do usuário
 * @param planId ID do plano a ser assinado ('basic' ou 'pro')
 * @param userId ID do usuário que está assinando (obrigatório para segurança)
 * @returns URL de redirecionamento para o checkout
 */
export const redirectToHublaCheckout = (planId: string, userId: string): string => {
  // Verificar se temos um link para este plano
  if (!HUBLA_CHECKOUT_URLS[planId]) {
    console.error(`Link de checkout não encontrado para o plano: ${planId}`);
    throw new Error(`Plano não suportado: ${planId}`);
  }

  // Verificar se o userId foi fornecido
  if (!userId) {
    console.error('ID do usuário é obrigatório para checkout');
    throw new Error('ID do usuário não fornecido');
  }
  
  // Adicionar metadados à URL do checkout
  const baseUrl = HUBLA_CHECKOUT_URLS[planId];
  const checkoutUrl = `${baseUrl}?metadata[userId]=${encodeURIComponent(userId)}&metadata[planId]=${encodeURIComponent(planId)}`;
  
  console.log(`Redirecionando para checkout com metadados: userId=${userId}, planId=${planId}`);
  return checkoutUrl;
}; 