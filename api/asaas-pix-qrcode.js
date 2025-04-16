const axios = require('axios');
const { MongoClient } = require('mongodb');

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_ENV = process.env.ASAAS_ENV || 'sandbox';
const ASAAS_API_URL = ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

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
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido',
      details: 'Este endpoint só aceita requisições GET' 
    });
  }

  const paymentId = req.query.paymentId;
  if (!paymentId) {
    return res.status(400).json({ 
      success: false,
      error: 'ID do pagamento não fornecido',
      details: 'O parâmetro paymentId é obrigatório'
    });
  }

  // Verificar API key
  if (!ASAAS_API_KEY || ASAAS_API_KEY === 'your_asaas_api_key') {
    return res.status(500).json({ 
      success: false,
      error: 'API key do Asaas não configurada',
      details: 'A variável de ambiente ASAAS_API_KEY não está configurada' 
    });
  }

  try {
    console.log(`Buscando QR code PIX para o pagamento ${paymentId}...`);

    // Buscar o pagamento no Asaas para verificar se ele existe e se é do tipo PIX
    const paymentResponse = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );

    console.log('Pagamento encontrado:', paymentResponse.data);

    // Verificar se o pagamento existe
    if (!paymentResponse.data) {
      return res.status(404).json({ 
        success: false,
        error: 'Pagamento não encontrado',
        details: `Não foi possível encontrar um pagamento com o ID ${paymentId}`
      });
    }

    // Verificar se o pagamento é do tipo PIX
    if (paymentResponse.data.billingType !== 'PIX') {
      return res.status(400).json({ 
        success: false,
        error: 'Pagamento não é do tipo PIX',
        details: `O pagamento ${paymentId} é do tipo ${paymentResponse.data.billingType}, não PIX`
      });
    }

    // Buscar o QR code PIX
    const pixResponse = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RunCash/1.0',
          'access_token': ASAAS_API_KEY
        }
      }
    );

    console.log('QR code PIX encontrado:', pixResponse.data);

    // Registrar no MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db();

    await db.collection('pix_codes').insertOne({
      payment_id: paymentId,
      qr_code_generated: true,
      expiration_date: pixResponse.data.expirationDate,
      created_at: new Date()
    });
    
    await client.close();

    // Retornar o QR code PIX
    return res.status(200).json({
      success: true,
      qrCodeImage: pixResponse.data.encodedImage,
      qrCodeText: pixResponse.data.payload,
      expirationDate: paymentResponse.data.dueDate
    });
  } catch (error) {
    console.error('Erro ao buscar QR code PIX:', error);

    if (error.response) {
      console.error('Resposta do erro:', error.response.data);
      
      // Verificar se o erro é de pagamento não encontrado (404)
      if (error.response.status === 404) {
        return res.status(404).json({ 
          success: false,
          error: 'Pagamento não encontrado',
          details: `Não foi possível encontrar um pagamento com o ID ${paymentId}`
        });
      }
      
      // Outros erros da API do Asaas
      return res.status(error.response.status).json({ 
        success: false,
        error: 'Erro na API do Asaas',
        details: error.response.data
      });
    } else if (error.request) {
      console.error('Erro na requisição:', error.request);
      return res.status(500).json({ 
        success: false,
        error: 'Erro ao comunicar com a API do Asaas',
        details: 'Não foi possível obter resposta da API do Asaas'
      });
    } else {
      console.error('Erro:', error.message);
      return res.status(500).json({ 
        success: false,
        error: 'Erro interno',
        details: error.message
      });
    }
  }
}; 