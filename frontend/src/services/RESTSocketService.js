import EventEmitter from 'events';
import RouletteService from './RouletteService';

class RESTSocketService {
  constructor() {
    this.emitter = new EventEmitter();
    this.dataListeners = new Map();
    this.pollingInterval = null;
    this.pollingIntervalMs = 4000; // 4 segundos
    this.isPolling = false;
    this.isCentralizedMode = true; // Modo centralizado usando GlobalRouletteService
    this.debug = process.env.NODE_ENV !== 'production';
    this.rouletteService = RouletteService.getInstance();
    
    this.lastReceivedTimestamp = 0;
  }

  // Registrar ouvinte para eventos
  on(event, callback) {
    this.emitter.on(event, callback);
    if (this.debug) console.log(`[RESTSocketService] Registrado listener para ${event}, total: ${this.emitter.listenerCount(event)}`);
    return () => this.emitter.removeListener(event, callback);
  }

  // Processar dados das roletas evitando duplicações
  processRouletteData(data, source = 'api') {
    // Usar o serviço centralizado para prevenir duplicações
    const uniqueData = this.rouletteService.processRouletteData(data, source);
    
    if (uniqueData.length === 0) {
      return; // Nenhum dado único para processar
    }
    
    // Processar apenas dados que não foram duplicados
    for (const roulette of uniqueData) {
      if (!roulette || !roulette.id) continue;
      
      const rouletteId = roulette.id;
      const lastNumbers = roulette.numeros || [];
      
      if (lastNumbers.length > 0) {
        if (this.debug) console.log(`[RESTSocketService] Novos números detectados para roleta ${roulette.nome || 'desconhecida'}`);
        
        // Emitir evento para o primeiro número (mais recente)
        const lastNumber = lastNumbers[0].numero;
        this.emitter.emit('new_number', {
          rouletteId,
          rouletteName: roulette.nome,
          number: lastNumber
        });
        
        if (this.debug) {
          console.log(`[RESTSocketService][GLOBAL] Evento recebido para roleta: ${roulette.nome}, número: ${lastNumber}`);
        }
        
        // Adicionar lógica para atualização de estratégia
        this.emitter.emit('strategy_update', {
          rouletteId,
          rouletteName: roulette.nome,
          status: 'NEUTRAL' // Estado padrão
        });
        
        if (this.debug) {
          console.log(`[RESTSocketService][GLOBAL] Atualização de estratégia para roleta: ${roulette.nome}, estado: NEUTRAL`);
        }
      }
    }
  }

  // Receber atualização de dados do serviço centralizado
  receiveCentralizedUpdate(data, timestamp) {
    if (!timestamp || timestamp <= this.lastReceivedTimestamp) {
      if (this.debug) console.log(`[RESTSocketService] Ignorando dados com timestamp obsoleto: ${timestamp} <= ${this.lastReceivedTimestamp}`);
      return;
    }
    
    this.lastReceivedTimestamp = timestamp;
    
    if (this.debug) console.log(`[RESTSocketService] Recebendo atualização do serviço global centralizado`);
    
    if (!data || !Array.isArray(data)) {
      if (this.debug) console.log(`[RESTSocketService] Dados inválidos recebidos do serviço centralizado`);
      return;
    }
    
    if (this.debug) console.log(`[RESTSocketService] Processando ${data.length} roletas da API REST`);
    
    const startTime = Date.now();
    this.processRouletteData(data, 'centralized-service');
    
    if (this.debug) {
      const elapsedTime = Date.now() - startTime;
      console.log(`[RESTSocketService] Processamento concluído em ${elapsedTime}ms`);
    }
  }
  
  // Receber dados do serviço centralizado
  receiveCentralData(data, timestamp) {
    if (this.debug) console.log(`[RESTSocketService] Recebendo dados do serviço centralizado`);
    if (this.debug) console.log(`[RESTSocketService] Processando dados do serviço centralizado: ${timestamp}`);
    
    if (!data || !Array.isArray(data)) {
      if (this.debug) console.log(`[RESTSocketService] Dados inválidos recebidos do serviço centralizado`);
      return;
    }
    
    if (this.debug) console.log(`[RESTSocketService] Processando ${data.length} roletas do serviço centralizado`);
    
    // Processar os dados através do serviço anti-duplicação
    this.processRouletteData(data, 'central-service');
  }

  // Outros métodos do serviço...
}

// Singleton
let instance = null;

export default {
  getInstance() {
    if (!instance) {
      instance = new RESTSocketService();
    }
    return instance;
  }
}; 