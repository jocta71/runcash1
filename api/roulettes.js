/**
 * API dedicada para manipulação de dados de roletas com cache e tratamento de erros
 */
const https = require('https');
const http = require('http');
const url = require('url');

// Configuração de timeout reduzido (3 segundos)
const REQUEST_TIMEOUT = 3000;

// Cache para armazenar respostas anteriores
let dataCache = {
  timestamp: null,
  data: null,
  expiresIn: 5 * 60 * 1000 // 5 minutos em milissegundos
};

// Dados de fallback para caso de erro
const FALLBACK_DATA = {
  success: true,
  error: null,
  data: [],
  timestamp: new Date().toISOString(),
  _cached: true,
  _fallback: true
};

/**
 * Verifica se o cache está válido
 */
function isCacheValid() {
  return (
    dataCache.timestamp && 
    dataCache.data && 
    (Date.now() - dataCache.timestamp) < dataCache.expiresIn
  );
}

/**
 * Função para fazer requisição ao backend com timeout
 */
async function fetchFromBackend(path) {
  // URL base da API de destino
  const targetUrl = 'https://backendapi-production-36b5.up.railway.app';
  const targetHostname = url.parse(targetUrl).hostname;
  
  // Construir opções para a requisição
  const options = {
    hostname: targetHostname,
    port: url.parse(targetUrl).port || 443,
    path,
    method: 'GET',
    headers: {
      host: targetHostname,
      'accept': 'application/json'
    },
    timeout: REQUEST_TIMEOUT
  };

  return new Promise((resolve, reject) => {
    const protocol = targetUrl.startsWith('https') ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (err) {
            reject(new Error(`Erro ao analisar JSON: ${err.message}`));
          }
        } else {
          reject(new Error(`Status inválido: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout da requisição'));
    });

    req.end();
  });
}

module.exports = async (req, res) => {
  // Log da requisição
  console.log('[ROULETTES] Recebida requisição:', {
    url: req.url,
    method: req.method,
    query: req.query || {},
    cache: isCacheValid() ? 'VALID' : 'EXPIRED'
  });
  
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Responder a requisições preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Determinar parâmetros de consulta
  const parsedUrl = url.parse(req.url, true);
  const limit = parsedUrl.query.limit ? Math.min(parseInt(parsedUrl.query.limit), 100) : 100; // Limitar a 100 itens
  
  // Construir o caminho da API
  const apiPath = `/api/ROULETTES?limit=${limit}`;
  
  try {
    // Verificar se temos dados em cache válidos
    if (isCacheValid()) {
      console.log('[ROULETTES] Retornando dados do cache');
      const response = {
        ...dataCache.data,
        _cached: true,
        timestamp: new Date().toISOString()
      };
      return res.status(200).json(response);
    }
    
    // Tentar buscar novos dados com timeout
    console.log('[ROULETTES] Buscando dados do backend...');
    const data = await Promise.race([
      fetchFromBackend(apiPath),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout de ${REQUEST_TIMEOUT}ms excedido`)), REQUEST_TIMEOUT)
      )
    ]);
    
    // Atualizar o cache com os novos dados
    dataCache = {
      timestamp: Date.now(),
      data,
      expiresIn: 5 * 60 * 1000 // 5 minutos
    };
    
    console.log(`[ROULETTES] Dados recebidos e armazenados em cache`);
    
    // Retornar os dados para o cliente
    return res.status(200).json({
      ...data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ROULETTES] Erro:', error);
    
    // Se temos cache expirado, ainda podemos usá-lo em caso de erro
    if (dataCache.data) {
      console.log('[ROULETTES] Usando cache expirado como fallback');
      const response = {
        ...dataCache.data,
        _cached: true,
        _expired: true,
        timestamp: new Date().toISOString(),
        error: error.message
      };
      return res.status(200).json(response);
    }
    
    // Sem cache, usar dados de fallback
    console.log('[ROULETTES] Usando dados de fallback');
    return res.status(200).json(FALLBACK_DATA);
  }
}; 