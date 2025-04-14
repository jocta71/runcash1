const axios = require('axios');

/**
 * Cliente frontend para integração com o Hubla
 * Permite a criação de checkouts e redirecionamento para página de pagamento
 */

/**
 * Cria um checkout no Hubla e retorna a URL para redirecionamento
 * @param {Object} params Parâmetros do checkout
 * @param {string} params.planId ID do plano (MENSAL ou ANUAL)
 * @param {string} params.userId ID do usuário
 * @param {string} params.name Nome do usuário
 * @param {string} params.email Email do usuário
 * @param {string} params.cpfCnpj CPF ou CNPJ do usuário (opcional)
 * @param {string} params.mobilePhone Telefone do usuário (opcional)
 * @returns {Promise<string>} URL do checkout
 */
exports.createHublaCheckout = async (params) => {
  try {
    console.log('Iniciando criação de checkout no Hubla:', params);
    
    // Validar parâmetros obrigatórios
    if (!params.planId || !params.userId || !params.name || !params.email) {
      throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    // Chamar API para criar checkout
    const response = await axios.post('/api/hubla-create-checkout', params);
    
    console.log('Resposta do servidor:', response.data);
    
    // Verificar se a resposta contém URL
    if (response.data && response.data.url) {
      return response.data.url;
    } else {
      throw new Error('Resposta da API inválida: URL de checkout não encontrada');
    }
  } catch (error) {
    console.error('Erro ao criar checkout no Hubla:', error);
    
    // Informações detalhadas do erro
    if (error.response) {
      console.error('Dados da resposta de erro:', error.response.data);
    }
    
    throw new Error(`Falha ao criar checkout: ${error.message}`);
  }
};

/**
 * Redireciona o usuário para a página de checkout do Hubla
 * @param {string} checkoutUrl URL do checkout
 * @returns {void}
 */
exports.redirectToHublaCheckout = (checkoutUrl) => {
  if (!checkoutUrl) {
    console.error('URL de checkout não fornecida');
    return;
  }
  
  console.log('Redirecionando para checkout do Hubla:', checkoutUrl);
  window.location.href = checkoutUrl;
};

/**
 * Fluxo completo para criação de checkout e redirecionamento
 * @param {Object} params Parâmetros do checkout (ver createHublaCheckout)
 * @returns {Promise<void>}
 */
exports.processHublaPayment = async (params) => {
  try {
    // Criar checkout
    const checkoutUrl = await exports.createHublaCheckout(params);
    
    // Redirecionar para checkout
    exports.redirectToHublaCheckout(checkoutUrl);
  } catch (error) {
    console.error('Erro no processo de pagamento com Hubla:', error);
    throw error;
  }
}; 