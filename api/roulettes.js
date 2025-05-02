const axios = require('axios');

/**
 * Endpoint /api/roulettes
 * Obtém a lista de todas as roletas disponíveis
 */
module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }
  
  try {
    console.log('[API] Processando requisição para /api/roulettes');

    // Configuração da API do backend
    const BACKEND_URL = process.env.BACKEND_URL || 'https://api.runcash.com.br';
    console.log(`[API] Usando URL do backend: ${BACKEND_URL}`);
    
    // Obter token de autorização do cabeçalho, se disponível
    const authorization = req.headers.authorization || '';
    
    // Preparar cabeçalhos para a requisição ao backend
    const headers = {};
    if (authorization) {
      headers.Authorization = authorization;
      console.log('[API] Token de autorização recebido');
    }

    // Adicionar parâmetros de consulta da requisição original
    let queryParams = '';
    if (Object.keys(req.query).length > 0) {
      queryParams = '?' + new URLSearchParams(req.query).toString();
      console.log(`[API] Parâmetros de consulta: ${queryParams}`);
    }

    // Configuração do cliente HTTP
    const apiClient = axios.create({
      baseURL: BACKEND_URL,
      headers
    });

    // Fazer a requisição para o backend
    const routeURL = `/api/roulettes${queryParams}`;
    console.log(`[API] Redirecionando para: ${BACKEND_URL}${routeURL}`);

    const response = await apiClient.get(routeURL);
    
    // Registrar o número de roletas retornadas
    if (response.data && Array.isArray(response.data)) {
      console.log(`[API] Retornando ${response.data.length} roletas`);
    }
    
    // Retornar resposta do backend para o cliente
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('[API] Erro ao processar requisição /api/roulettes:', error.message);
    
    // Verificar se o erro é da resposta do axios
    if (error.response) {
      // O servidor respondeu com um status diferente de 2xx
      return res.status(error.response.status || 500).json({
        success: false,
        error: 'Erro na comunicação com o backend',
        details: error.response.data || 'Sem detalhes disponíveis'
      });
    }
    
    // Para outros tipos de erros
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message || 'Ocorreu um erro ao processar sua requisição'
    });
  }
}; 