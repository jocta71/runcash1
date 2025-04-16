const axios = require('axios');
const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar método da requisição
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter o ID do pagamento da query
    const { paymentId } = req.query;

    if (!paymentId) {
      return res.status(400).json({ 
        error: 'Parâmetro ausente', 
        details: 'ID do pagamento é obrigatório' 
      });
    }

    // Configurar chamada para API do Asaas
    const asaasBaseUrl = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
    const asaasApiKey = process.env.ASAAS_API_KEY;

    if (!asaasApiKey) {
      throw new Error('Chave da API do Asaas não configurada');
    }

    // Buscar detalhes do pagamento
    const response = await axios.get(
      `${asaasBaseUrl}/payments/${paymentId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    // Verificar se a resposta contém os dados do pagamento
    if (!response.data || !response.data.id) {
      return res.status(404).json({ 
        error: 'Pagamento não encontrado',
        details: 'Não foi possível encontrar este pagamento'
      });
    }

    // Retornar os dados do pagamento
    return res.status(200).json({
      success: true,
      payment: {
        id: response.data.id,
        customer: response.data.customer,
        value: response.data.value,
        netValue: response.data.netValue,
        billingType: response.data.billingType,
        status: response.data.status,
        dueDate: response.data.dueDate,
        paymentDate: response.data.paymentDate,
        invoiceUrl: response.data.invoiceUrl,
        bankSlipUrl: response.data.bankSlipUrl,
        transactionReceiptUrl: response.data.transactionReceiptUrl,
        nossoNumero: response.data.nossoNumero,
        description: response.data.description,
        subscription: response.data.subscription,
        installment: response.data.installment,
        creditCard: response.data.creditCard ? {
          creditCardBrand: response.data.creditCard.creditCardBrand,
          creditCardNumber: response.data.creditCard.creditCardNumber,
        } : null,
        fine: response.data.fine,
        interest: response.data.interest,
        split: response.data.split
      }
    });
  } catch (error) {
    console.error('Erro ao buscar pagamento:', error);
    
    // Tratar erros específicos da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro ao buscar pagamento',
      message: error.message 
    });
  }
}; 