// Endpoint específico para números das roletas
const proxy = require('./proxy');

// Simplificar o processamento para o endpoint específico ROULETTES-numbers
module.exports = (req, res) => {
  // Obter os parâmetros de consulta da URL original
  const url = new URL(req.url, `http://${req.headers.host}`);
  const queryParams = url.search || '';
  
  // Definir o path para o endpoint ROULETTES-numbers no backend, mantendo os parâmetros de consulta
  const targetPath = `/api/ROULETTES-numbers${queryParams}`;
  
  console.log(`[ROULETTES-numbers proxy] Redirecionando para: ${targetPath}`);
  
  // Repassar para o proxy geral com o path específico
  req.url = targetPath;
  proxy(req, res);
}; 