// Endpoint específico para roletas
const proxy = require('./proxy');

// Simplificar o processamento para o endpoint específico ROULETTES
module.exports = (req, res) => {
  // Garantir que estamos buscando o endpoint correto
  req.url = '/api/ROULETTES';
  
  // Repassar para o proxy geral
  proxy(req, res);
};
