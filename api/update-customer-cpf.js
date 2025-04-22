// Endpoint para atualizar o CPF/CNPJ de um cliente no Asaas
const axios = require('axios');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder a requisições OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const { customerId, cpfCnpj } = req.body;

  // Validar dados obrigatórios
  if (!customerId) {
    return res.status(400).json({ error: 'customerId é obrigatório' });
  }

  if (!cpfCnpj) {
    return res.status(400).json({ error: 'cpfCnpj é obrigatório' });
  }

  // Limpar o CPF/CNPJ para conter apenas números
  const cleanedCpfCnpj = cpfCnpj.replace(/[^\d]/g, '');
  
  // Validar CPF/CNPJ
  if (cleanedCpfCnpj.length !== 11 && cleanedCpfCnpj.length !== 14) {
    return res.status(400).json({ error: 'CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos' });
  }

  const asaasKey = process.env.ASAAS_API_KEY;
  const asaasApiUrl = process.env.NODE_ENV === 'production' 
    ? 'https://api.asaas.com/v3' 
    : 'https://sandbox.asaas.com/api/v3';

  try {
    console.log(`Atualizando cliente ${customerId} com CPF/CNPJ: ${cleanedCpfCnpj}`);
    
    // Fazer a requisição para atualizar o cliente na API do Asaas
    const response = await axios({
      method: 'post',
      url: `${asaasApiUrl}/customers/${customerId}`,
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasKey
      },
      data: {
        cpfCnpj: cleanedCpfCnpj
      }
    });

    // Log da resposta completa para diagnóstico
    console.log('Resposta da API Asaas (atualização de CPF/CNPJ):', JSON.stringify(response.data));

    // Verificar a resposta do Asaas
    if (response.data && response.data.id) {
      return res.status(200).json({ 
        success: true, 
        message: 'CPF/CNPJ atualizado com sucesso',
        customer: response.data 
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Erro na atualização do CPF/CNPJ. Resposta inválida do Asaas.' 
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar CPF/CNPJ no Asaas:', error.response ? error.response.data : error.message);
    
    return res.status(500).json({
      success: false,
      error: error.response && error.response.data ? 
        `Erro do Asaas: ${JSON.stringify(error.response.data)}` : 
        `Erro ao atualizar CPF/CNPJ: ${error.message}`
    });
  }
}; 