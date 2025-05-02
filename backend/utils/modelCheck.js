/**
 * Utilitário para verificar a disponibilidade dos modelos
 * Pode ser utilizado para diagnóstico e monitoramento
 */
const mongoose = require('mongoose');

/**
 * Verifica se todos os modelos necessários estão disponíveis
 * @returns {Object} Resultado da verificação com status e detalhes
 */
function checkModels() {
  console.log('[ModelCheck] Verificando modelos registrados...');
  
  // Lista de modelos essenciais
  const requiredModels = [
    'User',
    'Subscription',
    'Payment',
    'Checkout',
    'WebhookEvent'
  ];
  
  const registeredModels = [];
  const missingModels = [];
  
  // Verificar cada modelo
  requiredModels.forEach(modelName => {
    try {
      mongoose.model(modelName);
      registeredModels.push(modelName);
    } catch (e) {
      missingModels.push(modelName);
    }
  });
  
  // Registrar resultados
  console.log(`[ModelCheck] Modelos registrados (${registeredModels.length}/${requiredModels.length}):`, registeredModels.join(', '));
  
  if (missingModels.length > 0) {
    console.warn(`[ModelCheck] Modelos NÃO registrados (${missingModels.length}):`, missingModels.join(', '));
  }
  
  return {
    success: missingModels.length === 0,
    registered: registeredModels,
    missing: missingModels,
    details: {
      timestamp: new Date().toISOString(),
      totalModels: requiredModels.length,
      registeredCount: registeredModels.length,
      missingCount: missingModels.length
    }
  };
}

/**
 * Força o carregamento de todos os modelos
 * @returns {Boolean} True se todos os modelos foram carregados com sucesso
 */
function forceLoadModels() {
  console.log('[ModelCheck] Forçando carregamento de modelos...');
  
  try {
    // Tentar carregar todos os modelos
    require('../models/index').ensureModelsLoaded();
    
    // Verificar novamente
    const checkResult = checkModels();
    return checkResult.success;
  } catch (error) {
    console.error('[ModelCheck] Erro ao forçar carregamento de modelos:', error);
    return false;
  }
}

module.exports = {
  checkModels,
  forceLoadModels
}; 