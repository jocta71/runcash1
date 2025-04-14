/**
 * Proxy para encaminhar solicitações para API externa de roletas
 * Agora redirecionando para o endpoint otimizado com cache
 */
const url = require('url');

// Importar o manipulador de roulettes otimizado
const roulettesHandler = require('./roulettes');

module.exports = async (req, res) => {
  // Log detalhado para depuração
  console.log('[PROXY-ROULETTE] Recebida requisição:', {
    url: req.url,
    method: req.method,
    query: req.query || {}
  });
  
  // Configuração CORS adequada para solicitações com credentials
  res.setHeader('Access-Control-Allow-Credentials', true);
  // Usar a origem específica em vez de wildcard para permitir credenciais
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Responder a requisições preflight OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Redirecionar para o manipulador de roulettes otimizado
  return roulettesHandler(req, res);
}; 