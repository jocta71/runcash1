/**
 * Script para iniciar o servidor de teste SSE
 * Este script serve como um ponto de entrada para executar o servidor de teste SSE.
 */

// Importar o módulo de teste
const path = require('path');
const testStreamPath = path.join(__dirname, 'api', 'roulettes', 'test_stream.js');

console.log(`Iniciando servidor de teste SSE a partir de: ${testStreamPath}`);

try {
  // Carregar e executar o script de teste
  require(testStreamPath);
  
  console.log('Servidor de teste SSE iniciado com sucesso!');
  console.log('Endpoints disponíveis:');
  console.log('- /stream/test');
  console.log('- /stream/rounds/ROULETTE/:tableId/v2/live');
} catch (error) {
  console.error('Erro ao iniciar o servidor de teste SSE:', error);
  process.exit(1);
} 