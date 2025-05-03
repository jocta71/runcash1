/**
 * Script para executar sincronização de assinaturas manualmente
 * Útil para testes ou para sincronização imediata
 */

// Importar o módulo de sincronização
const syncSubscriptions = require('../jobs/syncSubscriptions');

// Definir variável para log detalhado
process.env.VERBOSE_SYNC = 'true';

console.log('Iniciando sincronização manual de assinaturas...');

// Executar sincronização
syncSubscriptions()
  .then(result => {
    console.log('\nSincronização completa!');
    console.log('Resultado:', JSON.stringify(result, null, 2));
    
    // Encerrar o processo após a conclusão
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\nErro durante a sincronização:', error);
    process.exit(1);
  }); 