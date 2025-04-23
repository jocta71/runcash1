// Redirecionador para /backend/api/payment/asaas-pix-qrcode
const axios = require('axios');

module.exports = async (req, res) => {
  // Configuração de CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:5173'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  try {
    // Log limitado (sem dados sensíveis)
    console.log('Solicitação de QR Code PIX recebida em /api - Redirecionando para backend');
    
    // URL do novo endpoint
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const targetUrl = `${backendUrl}/api/payment/asaas-pix-qrcode`;
    
    // Construir URL com parâmetros de consulta
    const queryParams = new URLSearchParams(req.query).toString();
    const fullUrl = queryParams ? `${targetUrl}?${queryParams}` : targetUrl;
    
    // Encaminhar requisição para o backend (incluindo token de autorização)
    const response = await axios({
      method: 'GET',
      url: fullUrl,
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer' // Para receber o QR code em formato de imagem
    });
    
    // Verificar se a resposta é uma imagem ou JSON
    const contentType = response.headers['content-type'];
    
    if (contentType && contentType.includes('image')) {
      // Se for imagem, retornar com o mesmo tipo de conteúdo
      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(response.data);
    } else {
      // Se for JSON, converter o buffer para texto e analisar
      try {
        const jsonData = JSON.parse(Buffer.from(response.data).toString('utf8'));
        return res.status(response.status).json(jsonData);
      } catch (e) {
        // Se não for possível analisar como JSON, retornar os dados brutos
        return res.status(response.status).send(response.data);
      }
    }
  } catch (error) {
    console.error('Erro ao redirecionar solicitação de QR Code PIX:', error.message);
    
    // Se conseguimos um erro estruturado da API, utilizá-lo
    if (error.response) {
      return res.status(error.response.status || 500).json(error.response.data);
    }
    
    // Caso contrário, retornar erro genérico
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação de QR Code PIX',
      message: error.message
    });
  }
}; 