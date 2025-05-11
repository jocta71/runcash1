/**
 * Script para iniciar o servidor de API unificada de roletas
 */

const path = require('path');

// Caminho para o script da API unificada
const apiPath = path.join(__dirname, 'api', 'roulettes', 'test_api.js');

console.log(`Iniciando servidor de API unificada de roletas...`);
console.log(`Caminho do script: ${apiPath}`);

try {
  // Carregar e executar o script
  require(apiPath);
  
  console.log(`Servidor de API unificada iniciado com sucesso!`);
  console.log(`Acesse http://localhost:3004 para ver a documentação`);
  console.log(`Endpoints disponíveis:`);
  console.log(`- GET http://localhost:3004/api/roulettes`);
  console.log(`- GET http://localhost:3004/api/roulettes/:id`);
} catch (error) {
  console.error(`Erro ao iniciar o servidor de API unificada:`, error);
  process.exit(1);
} 