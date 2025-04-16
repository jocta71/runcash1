import axios from 'axios';

// Configuração para ambiente (sandbox ou produção)
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

export default async function handler(req, res) {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Lidar com requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar se o método é POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Obter o ID do pagamento do corpo da requisição
    const { paymentId } = req.body;
    
    if (!paymentId) {
      console.log('Erro: ID do pagamento não fornecido');
      return res.status(400).json({ error: 'ID do pagamento é obrigatório' });
    }

    console.log(`Gerando QR Code PIX para o pagamento: ${paymentId}`);

    // Configurar a requisição para a API do Asaas
    const response = await axios.get(
      `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY,
          'User-Agent': 'RunCash/1.0'
        }
      }
    );

    // Retornar os dados do QR Code PIX
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro ao gerar QR Code PIX:', error.response?.data || error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Erro ao gerar QR Code PIX',
      details: error.response?.data || error.message
    });
  }
} 