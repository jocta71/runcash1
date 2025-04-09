// Socket.IO proxy endpoint para WebSocket em Vercel
const proxy = require('./proxy');

module.exports = (req, res) => {
  console.log(`[Socket.IO] Recebendo requisição: ${req.method} ${req.url}`);
  
  // Redirecionar para o endpoint ROULETTES
  req.url = '/api/ROULETTES';
  
  // Adicionar headers para WebSocket
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Tratar preflight requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }
  
  // Repassar para o proxy geral
  proxy(req, res);
}; 