// Endpoint consolidado para todas as operações de assinatura Asaas
const axios = require('axios');

module.exports = async (req, res) => {
  // Log detalhado da requisição (sem dados sensíveis)
  console.log('Requisição recebida em asaas-subscriptions:', {
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
  
  // Extrair a operação da URL (/api/asaas-subscriptions?op=create, find, cancel)
  const operation = req.query.op;
  
  // Validar operação
  if (!operation) {
    console.log('Erro: Parâmetro de operação não fornecido');
    return res.status(400).json({ 
      error: 'Parâmetro de operação (op) é obrigatório',
      availableOperations: ['create', 'find', 'cancel']
    });
  }
  
  // Remover o parâmetro 'op' para não enviar ao backend
  const queryParams = { ...req.query };
  delete queryParams.op;
  
  try {
    // Roteamento baseado no método HTTP e operação
    if (req.method === 'POST') {
      let targetUrl = '';
      
      if (operation === 'create') {
        // CRIAR ASSINATURA
        console.log('Solicitação de criação de assinatura recebida - Redirecionando para backend');
        targetUrl = `${backendUrl}/api/payment/asaas-create-subscription`;
      } else if (operation === 'cancel') {
        // CANCELAR ASSINATURA
        console.log('Solicitação de cancelamento de assinatura recebida - Redirecionando para backend');
        targetUrl = `${backendUrl}/api/payment/asaas-cancel-subscription`;
      } else {
        console.log(`Operação inválida para método POST: ${operation}`);
        return res.status(400).json({ 
          error: 'Operação inválida para método POST',
          availableOperations: ['create', 'cancel']
        });
      }
      
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
    } else if (req.method === 'GET') {
      if (operation === 'find') {
        // CONSULTAR ASSINATURA
        console.log('Solicitação de consulta de assinatura recebida - Redirecionando para backend');
        
        const targetUrl = `${backendUrl}/api/payment/asaas-find-subscription`;
        
        // Construir URL com parâmetros de consulta
        const formattedQueryParams = new URLSearchParams(queryParams).toString();
        const fullUrl = formattedQueryParams ? `${targetUrl}?${formattedQueryParams}` : targetUrl;
        
        console.log('URL alvo:', fullUrl);
        
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
          console.error('Erro na solicitação axios (find):', {
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
          availableOperations: ['find']
        });
      }
    } else {
      console.log(`Método HTTP não permitido: ${req.method}`);
      return res.status(405).json({ 
        error: 'Método não permitido',
        allowedMethods: ['GET', 'POST', 'OPTIONS']
      });
    }
  } catch (error) {
    console.error(`Erro não tratado ao processar solicitação de assinatura (${operation}):`, {
      mensagem: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      nome: error.name,
      código: error.code
    });
    
    // Retornar erro genérico
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação de ${operation || 'assinatura'}`,
      message: error.message,
      type: error.name
    });
  }
}; 