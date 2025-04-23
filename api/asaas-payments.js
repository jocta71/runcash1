// Endpoint consolidado para todas as operações de pagamento Asaas
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // URL base do backend
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  
  // Extrair a operação da URL (/api/asaas-payments?op=create, list, get, qrcode)
  const operation = req.query.op;
  
  // Remover o parâmetro 'op' para não enviar ao backend
  const queryParams = { ...req.query };
  delete queryParams.op;
  
  try {
    // Roteamento baseado no método HTTP e operação
    if (req.method === 'POST') {
      if (operation === 'create') {
        // CRIAR PAGAMENTO
        console.log('Solicitação de criação de cobrança recebida em /api - Redirecionando para backend');
        
        const targetUrl = `${backendUrl}/api/payment/asaas-create-payment`;
        
        const response = await axios({
          method: 'POST',
          url: targetUrl,
          data: req.body,
          headers: {
            'Authorization': req.headers.authorization || '',
            'Content-Type': 'application/json'
          }
        });
        
        return res.status(response.status).json(response.data);
      } else {
        return res.status(400).json({ error: 'Operação inválida para método POST' });
      }
    } else if (req.method === 'GET') {
      // Construir URL com parâmetros de consulta
      const formattedQueryParams = new URLSearchParams(queryParams).toString();
      
      if (operation === 'list') {
        // LISTAR PAGAMENTOS
        console.log('Solicitação de listagem de cobranças recebida em /api - Redirecionando para backend');
        
        const targetUrl = `${backendUrl}/api/payment/asaas-list-payments`;
        const fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        
        const response = await axios({
          method: 'GET',
          url: fullUrl,
          headers: {
            'Authorization': req.headers.authorization || '',
            'Content-Type': 'application/json'
          }
        });
        
        return res.status(response.status).json(response.data);
      } else if (operation === 'get') {
        // OBTER PAGAMENTO ESPECÍFICO
        console.log('Solicitação de consulta de pagamento recebida em /api - Redirecionando para backend');
        
        const targetUrl = `${backendUrl}/api/payment/asaas-get-payment`;
        const fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        
        const response = await axios({
          method: 'GET',
          url: fullUrl,
          headers: {
            'Authorization': req.headers.authorization || '',
            'Content-Type': 'application/json'
          }
        });
        
        return res.status(response.status).json(response.data);
      } else if (operation === 'find') {
        // PROCURAR PAGAMENTO
        console.log('Solicitação de busca de pagamento recebida em /api - Redirecionando para backend');
        
        const targetUrl = `${backendUrl}/api/payment/asaas-find-payment`;
        const fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        
        const response = await axios({
          method: 'GET',
          url: fullUrl,
          headers: {
            'Authorization': req.headers.authorization || '',
            'Content-Type': 'application/json'
          }
        });
        
        return res.status(response.status).json(response.data);
      } else if (operation === 'qrcode') {
        // GERAR QR CODE PIX
        console.log('Solicitação de QR Code PIX recebida em /api - Redirecionando para backend');
        
        const targetUrl = `${backendUrl}/api/payment/asaas-pix-qrcode`;
        const fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        
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
      } else {
        return res.status(400).json({ error: 'Operação inválida para método GET' });
      }
    } else {
      return res.status(405).json({ error: 'Método não permitido' });
    }
  } catch (error) {
    console.error(`Erro ao redirecionar solicitação (${operation}):`, error.message);
    
    // Se conseguimos um erro estruturado da API, utilizá-lo
    if (error.response) {
      return res.status(error.response.status || 500).json(error.response.data);
    }
    
    // Caso contrário, retornar erro genérico
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação de ${operation || 'pagamento'}`,
      message: error.message
    });
  }
}; 