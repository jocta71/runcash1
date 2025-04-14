/**
 * Cliente para integração com Hubla
 */

// Links de pagamento da Hubla (configurados no painel)
const HUBLA_CHECKOUT_URLS: Record<string, string> = {
  basic: 'https://pay.hub.la/sD6k3KyqLtK7Kyyyl5YA',
  pro: 'https://pay.hub.la/5dYVW0YLLn8qC3dPQDFf'
};

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