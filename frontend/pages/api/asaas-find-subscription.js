// Endpoint para buscar assinatura no Asaas
import https from 'https';
import cookie from 'cookie';

// URL do backend no Railway
const BACKEND_URL = 'https://backend-production-2f96.up.railway.app';
const API_PATH = '/api/payment/asaas/find-subscription';

export default async function handler(req, res) {
  // Configurar CORS para permitir requisições cross-origin
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Responder imediatamente para requisições de preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extrair tokens de autenticação dos cookies e headers
    const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
    const authToken = req.headers.authorization || cookies['auth-token'] || '';
    const customerId = req.query.customerId;
    
    if (!customerId) {
      return res.status(400).json({ 
        error: true, 
        message: 'customerId é obrigatório' 
      });
    }
    
    // Construir URL para o backend
    const targetUrl = `${BACKEND_URL}${API_PATH}?customerId=${encodeURIComponent(customerId)}`;
    
    console.log(`[ASAAS-FIND] Buscando assinatura para cliente: ${customerId}`);
    
    // Configurar opções para a requisição ao backend
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken
      }
    };
    
    // Fazer requisição para o backend
    const response = await fetch(targetUrl, options);
    const data = await response.json();
    
    // Retornar dados da assinatura
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[ASAAS-FIND] Erro ao buscar assinatura:', error);
    return res.status(500).json({
      error: true,
      message: `Erro ao buscar informações de assinatura: ${error.message}`
    });
  }
} 