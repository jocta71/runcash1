/**
 * Arquivo de inicialização dos modelos
 * Este arquivo garante que todos os modelos são carregados
 * na ordem correta para evitar problemas de dependência
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Carregar modelos na ordem correta
try {
  // Modelos essenciais para o sistema de webhooks
  require('./User');
  require('./Subscription');
  require('./Payment'); 
  require('./Checkout');
  require('./WebhookEvent');
  console.log('[MODELS] Modelos carregados explicitamente no início');
} catch (error) {
  console.warn('[MODELS] Erro ao carregar modelos inicialmente:', error.message);
}

// Exportar uma função que pode ser usada para garantir que os modelos são carregados
module.exports = {
  ensureModelsLoaded: () => {
    console.log('[MODELS] Verificando inicialização dos modelos...');
    
    try {
      const models = [
        'User',
        'Subscription',
        'Payment',
        'Checkout',
        'WebhookEvent'
      ];
      
      let allLoaded = true;
      
      // Verificar cada modelo e tentar carregá-lo se não estiver disponível
      models.forEach(modelName => {
        try {
          // Tentar obter o modelo para verificar se já está registrado
          mongoose.model(modelName);
          console.log(`[MODELS] Modelo ${modelName} já está registrado`);
        } catch (e) {
          // Modelo não encontrado, tentar carregá-lo
          console.warn(`[MODELS] Modelo ${modelName} não está registrado, tentando carregar...`);
          
          try {
            // Tentar carregar o arquivo do modelo
            const modelPath = path.join(__dirname, `${modelName}.js`);
            
            if (fs.existsSync(modelPath)) {
              // Arquivo existe, tentar carregá-lo
              require(`./${modelName}`);
              console.log(`[MODELS] Modelo ${modelName} carregado com sucesso`);
            } else {
              console.error(`[MODELS] Arquivo do modelo ${modelName} não encontrado em: ${modelPath}`);
              allLoaded = false;
            }
          } catch (loadError) {
            console.error(`[MODELS] Erro ao carregar modelo ${modelName}:`, loadError);
            allLoaded = false;
          }
        }
      });
      
      if (allLoaded) {
        console.log('[MODELS] Todos os modelos foram carregados com sucesso');
      } else {
        console.warn('[MODELS] Alguns modelos não puderam ser carregados');
      }
      
      return allLoaded;
    } catch (error) {
      console.error('[MODELS] Erro ao verificar inicialização dos modelos:', error);
      return false;
    }
  },
  
  // Função para forçar o registro de um modelo específico
  registerModel: (modelName) => {
    try {
      // Verificar se o modelo já está registrado
      try {
        mongoose.model(modelName);
        console.log(`[MODELS] Modelo ${modelName} já está registrado`);
        return true;
      } catch (e) {
        // Modelo não encontrado, tentar carregá-lo
        const modelPath = path.join(__dirname, `${modelName}.js`);
        
        if (fs.existsSync(modelPath)) {
          require(`./${modelName}`);
          console.log(`[MODELS] Modelo ${modelName} registrado com sucesso`);
          return true;
        } else {
          console.error(`[MODELS] Arquivo do modelo ${modelName} não encontrado`);
          return false;
        }
      }
    } catch (error) {
      console.error(`[MODELS] Erro ao registrar modelo ${modelName}:`, error);
      return false;
    }
  }
}; 