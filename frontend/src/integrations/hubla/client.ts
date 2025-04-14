/**
 * Cliente para integração com Hubla
 */

// Links de pagamento da Hubla (configurados no painel)
const HUBLA_CHECKOUT_URLS: Record<string, string> = {
  basic: 'https://pay.hub.la/sD6k3KyqLtK7Kyyyl5YA',
  pro: 'https://pay.hub.la/5dYVW0YLLn8qC3dPQDFf'
};

/**
 * Redireciona para checkout da Hubla
 * @param planId ID do plano a ser assinado ('basic' ou 'pro')
 * @returns URL de redirecionamento para o checkout
 */
export const redirectToHublaCheckout = (planId: string): string => {
  // Verificar se temos um link para este plano
  if (HUBLA_CHECKOUT_URLS[planId]) {
    return HUBLA_CHECKOUT_URLS[planId];
  }
  
  // Caso o plano não seja encontrado, retornar um erro
  console.error(`Link de checkout não encontrado para o plano: ${planId}`);
  throw new Error(`Plano não suportado: ${planId}`);
}; 