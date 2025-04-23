// Redirecionador para endpoints da API Asaas - facilita a migração para a estrutura /backend/api/payment
const axios = require('axios');

/**
 * Este arquivo funciona como um redirecionador de compatibilidade.
 * Ele encaminha as requisições dos endpoints antigos em /api para seus
 * equivalentes na nova estrutura em /backend/api/payment.
 * 
 * Isso permite uma migração gradual sem quebrar integrações existentes.
 */

module.exports = async (req, res) => {
  // Configuração de CORS para permitir solicitações na fase de transição
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Signature');

  // Responder a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extrair o caminho e o nome do endpoint
  const originalUrl = req.url;
  const endpointPath = originalUrl.split('?')[0]; // Remove query params
  const endpointName = endpointPath.split('/').pop();
  
  // Determinar o novo caminho no backend
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  let newEndpoint = '';
  
  // Mapear endpoints antigos para novos
  switch (endpointName) {
    case 'asaas-webhook':
      newEndpoint = '/api/payment/asaas-webhook';
      break;
    case 'asaas-create-subscription':
      newEndpoint = '/api/payment/asaas-create-subscription';
      break;
    case 'asaas-create-customer':
      newEndpoint = '/api/payment/asaas-create-customer';
      break;
    case 'asaas-find-customer':
      newEndpoint = '/api/payment/asaas-find-customer';
      break;
    case 'asaas-find-payment':
      newEndpoint = '/api/payment/asaas-find-payment';
      break;
    case 'asaas-find-subscription':
      newEndpoint = '/api/payment/asaas-find-subscription';
      break;
    case 'asaas-cancel-subscription':
      newEndpoint = '/api/payment/asaas-cancel-subscription';
      break;
    case 'asaas-pix-qrcode':
      newEndpoint = '/api/payment/asaas-pix-qrcode';
      break;
    default:
      return res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado ou não migrado'
      });
  }
  
  // Construir a URL completa para o backend
  const targetUrl = `${backendUrl}${newEndpoint}`;
  console.log(`Redirecionando requisição de ${endpointPath} para ${targetUrl}`);
  
  try {
    // Encaminhar a requisição para o novo endpoint
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: {
        // Manter os headers originais, exceto aqueles específicos para o proxy
        ...req.headers,
        host: undefined,
        'content-length': undefined
      },
      validateStatus: () => true // Aceitar qualquer status para repassar corretamente
    });
    
    // Repassar a resposta do backend
    res.status(response.status);
    
    // Copiar headers relevantes da resposta
    const headersToForward = [
      'content-type', 
      'cache-control', 
      'expires', 
      'pragma',
      'x-ratelimit-limit',
      'x-ratelimit-remaining'
    ];
    
    for (const header of headersToForward) {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    }
    
    // Enviar corpo da resposta
    return res.json(response.data);
  } catch (error) {
    console.error('Erro ao redirecionar requisição:', error.message);
    
    return res.status(502).json({
      success: false,
      error: 'Erro ao redirecionar para o novo endpoint',
      message: process.env.NODE_ENV === 'production' ? 'Erro interno' : error.message
    });
  }
}; 