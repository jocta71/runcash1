/**
 * Configuração de cron jobs para tarefas programadas
 */

const cron = require('node-cron');
const syncSubscriptions = require('./syncSubscriptions');

// Log com timestamp
function log(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

/**
 * Configura todos os cron jobs da aplicação
 */
function setupCronJobs() {
  log('Configurando cron jobs...');
  
  // Sincronização de assinaturas - executa a cada 4 horas (0 */4 * * *)
  // Para testes, pode-se usar uma frequência maior, como a cada 1 minuto ('* * * * *')
  cron.schedule('0 */4 * * *', async () => {
    log('Iniciando job de sincronização de assinaturas');
    try {
      const result = await syncSubscriptions();
      log(`Job de sincronização completado com ${result.success ? 'sucesso' : 'falha'}`);
      if (result.success) {
        log(`Estatísticas: ${result.created} criados, ${result.updated} atualizados, ${result.inactivated} inativados`);
      } else {
        log(`Erro: ${result.error}`);
      }
    } catch (error) {
      log(`Erro fatal no job de sincronização: ${error.message}`);
    }
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo' // Ajuste para o fuso horário apropriado
  });
  
  log('Todos os cron jobs foram configurados com sucesso');
}

module.exports = setupCronJobs; 