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

    // Obter QR code do pagamento
    const response = await axios.get(
      `${asaasBaseUrl}/payments/${paymentId}/pixQrCode`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': asaasApiKey
        }
      }
    );

    // Verificar se a resposta contém os dados do QR code
    if (!response.data || !response.data.encodedImage) {
      return res.status(404).json({ 
        error: 'QR Code não encontrado',
        details: 'Não foi possível obter o QR code para este pagamento'
      });
    }

    // Retornar os dados do QR code
    return res.status(200).json({
      success: true,
      paymentId: paymentId,
      qrCodeImage: response.data.encodedImage,
      qrCodeText: response.data.payload,
      expirationDate: response.data.expirationDate
    });
  } catch (error) {
    console.error('Erro ao obter QR code PIX:', error);
    
    // Tratar erros específicos da API do Asaas
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro ao obter QR code PIX',
      message: error.message 
    });
  }
}; 