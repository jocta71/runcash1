const rouletteRoutes = require('./routes');
const { setupHeartbeats } = require('./utils/stream');

/**
 * Inicializa o módulo de roleta
 * @param {Object} app - Aplicação Express
 */
const initialize = (app) => {
  // Registrar as rotas no servidor principal
  app.use('/api/roulettes', rouletteRoutes);
  
  // Configurar heartbeats para conexões SSE
  setupHeartbeats();
  
  console.log('Módulo de roleta inicializado com sucesso');
};

module.exports = {
  initialize,
  routes: rouletteRoutes
}; 