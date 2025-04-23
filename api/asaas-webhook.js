// Redirecionador para /backend/api/payment/asaas-webhook
const axios = require('axios');

module.exports = async (req, res) => {
  // Configuração de CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:5173',
    'https://sandbox.asaas.com',
    'https://www.asaas.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  try {
    // Log limitado (sem dados sensíveis)
    console.log('Webhook do Asaas recebido em /api - Redirecionando para backend');
    
    // Dados do evento (para log, omitindo dados sensíveis)
    if (req.body && req.body.event) {
      console.log(`Tipo de evento: ${req.body.event}`);
    }
    
    // URL do novo endpoint
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const targetUrl = `${backendUrl}/api/payment/asaas-webhook`;
    
    // Encaminhar requisição para o backend com todo o payload
    const response = await axios({
      method: 'POST',
      url: targetUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Retornar a resposta do backend
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro ao redirecionar webhook do Asaas:', error.message);
    
    // Se conseguimos um erro estruturado da API, utilizá-lo
    if (error.response) {
      return res.status(error.response.status || 500).json(error.response.data);
    }
    
    // Caso contrário, retornar erro genérico
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar webhook do Asaas',
      message: error.message
    });
  }
}; 