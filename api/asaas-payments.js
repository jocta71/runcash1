// Endpoint consolidado para todas as operações de pagamento Asaas
const axios = require('axios');

module.exports = async (req, res) => {
  // Log detalhado da requisição (sem dados sensíveis)
  console.log('Requisição recebida em asaas-payments:', {
    método: req.method,
    operação: req.query.op,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    }
  });

  // Configuração de CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:5173',
    'https://runcashh11.vercel.app' // Adicionar explicitamente o domínio de produção
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Permitir qualquer origem em ambiente de desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
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
  console.log('Usando backend URL:', backendUrl);
  
  // Extrair a operação da URL (/api/asaas-payments?op=create, list, get, qrcode)
  const operation = req.query.op;
  
  // Validar operação
  if (!operation) {
    console.log('Erro: Parâmetro de operação não fornecido');
    return res.status(400).json({ 
      error: 'Parâmetro de operação (op) é obrigatório',
      availableOperations: ['create', 'list', 'get', 'find', 'qrcode']
    });
  }
  
  // Remover o parâmetro 'op' para não enviar ao backend
  const queryParams = { ...req.query };
  delete queryParams.op;
  
  try {
    // Roteamento baseado no método HTTP e operação
    if (req.method === 'POST') {
      if (operation === 'create') {
        // CRIAR PAGAMENTO
        console.log('Solicitação de criação de cobrança recebida - Redirecionando para backend');
        
        const targetUrl = `${backendUrl}/api/payment/asaas-create-payment`;
        console.log('URL alvo:', targetUrl);
        
        try {
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
        } catch (axiosError) {
          console.error('Erro na solicitação axios:', {
            mensagem: axiosError.message,
            status: axiosError.response?.status,
            data: axiosError.response?.data
          });
          
          if (axiosError.response) {
            return res.status(axiosError.response.status || 500).json(axiosError.response.data);
          }
          
          throw axiosError; // Propagar para o tratamento de erro externo
        }
      } else {
        console.log(`Operação inválida para método POST: ${operation}`);
        return res.status(400).json({ 
          error: 'Operação inválida para método POST',
          availableOperations: ['create']
        });
      }
    } else if (req.method === 'GET') {
      // Construir URL com parâmetros de consulta
      const formattedQueryParams = new URLSearchParams(queryParams).toString();
      
      let targetUrl = '';
      let fullUrl = '';
      
      if (operation === 'list') {
        // LISTAR PAGAMENTOS
        console.log('Solicitação de listagem de cobranças recebida - Redirecionando para backend');
        
        targetUrl = `${backendUrl}/api/payment/asaas-list-payments`;
        fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        console.log('URL alvo:', fullUrl);
        
      } else if (operation === 'get') {
        // OBTER PAGAMENTO ESPECÍFICO
        console.log('Solicitação de consulta de pagamento recebida - Redirecionando para backend');
        
        targetUrl = `${backendUrl}/api/payment/asaas-get-payment`;
        fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        console.log('URL alvo:', fullUrl);
        
      } else if (operation === 'find') {
        // PROCURAR PAGAMENTO
        console.log('Solicitação de busca de pagamento recebida - Redirecionando para backend');
        
        targetUrl = `${backendUrl}/api/payment/asaas-find-payment`;
        fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        console.log('URL alvo:', fullUrl);
        
      } else if (operation === 'qrcode') {
        // GERAR QR CODE PIX
        console.log('Solicitação de QR Code PIX recebida - Redirecionando para backend');
        
        targetUrl = `${backendUrl}/api/payment/asaas-pix-qrcode`;
        fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        console.log('URL alvo:', fullUrl);
        
        try {
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
          console.log('Tipo de conteúdo da resposta:', contentType);
          
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
              console.error('Erro ao processar resposta JSON:', e.message);
              // Se não for possível analisar como JSON, retornar os dados brutos
              return res.status(response.status).send(response.data);
            }
          }
        } catch (axiosError) {
          console.error('Erro na solicitação axios (qrcode):', {
            mensagem: axiosError.message,
            status: axiosError.response?.status,
            data: axiosError.response?.data
          });
          
          if (axiosError.response) {
            return res.status(axiosError.response.status || 500).json(axiosError.response.data);
          }
          
          throw axiosError; // Propagar para o tratamento de erro externo
        }
      } else {
        console.log(`Operação inválida para método GET: ${operation}`);
        return res.status(400).json({ 
          error: 'Operação inválida para método GET',
          availableOperations: ['list', 'get', 'find', 'qrcode']
        });
      }
      
      // Para todas as operações GET exceto qrcode (que já tem tratamento especial)
      if (operation !== 'qrcode') {
        try {
          const response = await axios({
            method: 'GET',
            url: fullUrl,
            headers: {
              'Authorization': req.headers.authorization || '',
              'Content-Type': 'application/json'
            }
          });
          
          return res.status(response.status).json(response.data);
        } catch (axiosError) {
          console.error(`Erro na solicitação axios (${operation}):`, {
            mensagem: axiosError.message,
            status: axiosError.response?.status,
            data: axiosError.response?.data
          });
          
          if (axiosError.response) {
            return res.status(axiosError.response.status || 500).json(axiosError.response.data);
          }
          
          throw axiosError; // Propagar para o tratamento de erro externo
        }
      }
    } else {
      console.log(`Método HTTP não permitido: ${req.method}`);
      return res.status(405).json({ 
        error: 'Método não permitido',
        allowedMethods: ['GET', 'POST', 'OPTIONS']
      });
    }
  } catch (error) {
    console.error(`Erro não tratado ao processar solicitação (${operation}):`, {
      mensagem: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      nome: error.name,
      código: error.code
    });
    
    // Caso contrário, retornar erro genérico
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação de ${operation || 'pagamento'}`,
      message: error.message,
      type: error.name
    });
  }
}; 