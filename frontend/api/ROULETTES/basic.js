// Endpoint específico para dados básicos das roletas
const proxy = require('../proxy');

// Handler para o endpoint de dados básicos das roletas
module.exports = (req, res) => {
  // Modificar URL para apontar para o endpoint específico no backend
  req.url = '/api/ROULETTES?mode=basic';
  
  // Log de diagnóstico
  console.log('[API] Redirecionando para endpoint básico via', req.url);
  
  // Enviar cabeçalhos CORS explícitos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Se for uma requisição OPTIONS, responder imediatamente
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Repassar para o proxy geral
  proxy(req, res);
}; 