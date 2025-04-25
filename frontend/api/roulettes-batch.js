// Endpoint otimizado para roletas em lotes
const proxy = require('./proxy');

/**
 * Endpoint otimizado para buscar dados de roletas em lotes
 * Este endpoint melhora a performance reduzindo a quantidade de dados transferidos
 * e processando-os de forma mais eficiente
 */
module.exports = (req, res) => {
  // Configurar para buscar o endpoint de backend
  req.url = '/api/roulettes-batch';
  
  // Adicionar cabeçalhos de otimização
  const headers = req.headers || {};
  headers['x-optimization-enabled'] = 'true';
  headers['x-client-version'] = process.env.APP_VERSION || '1.0.0';
  req.headers = headers;
  
  console.log(`[API] Endpoint roulettes-batch solicitado com parâmetros: ${req.query ? JSON.stringify(req.query) : 'nenhum'}`);
  
  // Repassar para o proxy geral
  proxy(req, res);
}; 