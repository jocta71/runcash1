// Endpoint específico para números de uma roleta específica
const proxy = require('../proxy');

// Handler para o endpoint de números de roletas
module.exports = (req, res) => {
  // Extrair o ID da roleta do caminho da URL
  const id = req.query.id;
  
  if (!id) {
    return res.status(400).json({ error: 'ID da roleta não fornecido' });
  }
  
  // Modificar URL para apontar para o endpoint correto no backend
  req.url = `/api/numbers/byid/${id}?limit=${req.query.limit || 50}`;
  
  // Log de diagnóstico
  console.log(`[API] Buscando números para roleta ${id} via ${req.url}`);
  
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