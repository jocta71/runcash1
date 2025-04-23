// Redirecionador para /backend/api/payment/asaas-webhook
const axios = require('axios');

module.exports = async (req, res) => {
  // Log detalhado da requisição (sem dados sensíveis)
  console.log('Requisição recebida em asaas-webhook:', {
    método: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    eventoTipo: req.body?.event || 'não especificado'
  });

  // Configuração de CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:5173',
    'https://sandbox.asaas.com',
    'https://www.asaas.com',
    'https://runcashh11.vercel.app' // Adicionar explicitamente o domínio de produção
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Para webhooks, podemos ser mais permissivos em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
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
    console.log(`Método HTTP não permitido para webhook: ${req.method}`);
    return res.status(405).json({ 
      error: 'Método não permitido',
      allowedMethods: ['POST', 'OPTIONS']
    });
  }
  
  try {
    // Log limitado (sem dados sensíveis)
    console.log('Webhook do Asaas recebido - Redirecionando para backend');
    
    // Dados do evento (para log, omitindo dados sensíveis)
    if (req.body && req.body.event) {
      console.log(`Tipo de evento: ${req.body.event}`);
      console.log(`ID do pagamento/assinatura: ${req.body.payment?.id || req.body.subscription?.id || 'N/A'}`);
    }
    
    // URL do novo endpoint
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const targetUrl = `${backendUrl}/api/payment/asaas-webhook`;
    
    console.log('URL alvo do webhook:', targetUrl);
    
    try {
      // Encaminhar requisição para o backend com todo o payload
      const response = await axios({
        method: 'POST',
        url: targetUrl,
        data: req.body,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Resposta do backend para webhook:', {
        status: response.status,
        sucesso: response.data?.success || false
      });
      
      // Retornar a resposta do backend
      return res.status(response.status).json(response.data);
    } catch (axiosError) {
      console.error('Erro na solicitação axios para webhook:', {
        mensagem: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data
      });
      
      if (axiosError.response) {
        return res.status(axiosError.response.status || 500).json(axiosError.response.data);
      }
      
      throw axiosError; // Propagar para o tratamento de erro externo
    }
  } catch (error) {
    console.error('Erro não tratado ao processar webhook do Asaas:', {
      mensagem: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      nome: error.name,
      código: error.code,
      evento: req.body?.event || 'desconhecido'
    });
    
    // Caso contrário, retornar erro genérico
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar webhook do Asaas',
      message: error.message,
      type: error.name
    });
  }
}; 