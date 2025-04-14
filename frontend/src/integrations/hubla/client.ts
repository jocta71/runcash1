/**
 * Cliente para integração com Hubla
 */

// Links de pagamento da Hubla (configurados no painel)
const HUBLA_CHECKOUT_URLS: Record<string, string> = {
  MENSAL: 'https://pay.hub.la/sD6k3KyqLtK7Kyyyl5YA',
  ANUAL: 'https://pay.hub.la/5dYVW0YLLn8qC3dPQDFf'
};

/**
 * Redireciona para checkout da Hubla
 * @param planId ID do plano a ser assinado (MENSAL ou ANUAL)
 * @returns URL de redirecionamento para o checkout
 */
export const redirectToHublaCheckout = (planId: string): string => {
  // Converter o ID do plano para maiúsculas para garantir compatibilidade
  const normalizedPlanId = planId.toUpperCase();
  
  // Verificar se temos um link para este plano
  if (HUBLA_CHECKOUT_URLS[normalizedPlanId]) {
    return HUBLA_CHECKOUT_URLS[normalizedPlanId];
  }
  
  // Caso o plano não seja encontrado, retornar um erro
  console.error(`Link de checkout não encontrado para o plano: ${planId}`);
  throw new Error(`Plano não suportado: ${planId}`);
}; 