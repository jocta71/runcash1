/**
 * RouletteService.js
 * Serviço para controle de duplicação de dados de roletas
 * Implementa um mecanismo para evitar que o mesmo dado seja processado 
 * múltiplas vezes por diferentes fontes de dados
 */

import EventEmitter from 'events';

/**
 * Serviço Singleton para gerenciar o controle de dados de roletas
 * e prevenir duplicações no sistema
 */
class RouletteService {
  static instance;
  
  // Armazenar IDs de dados processados, com timestamps de expiração
  #processedDataIds = new Map();
  
  // Manter registro das fontes de dados ativas
  #activeDataSources = new Set();
  
  // Tempo de expiração para dados processados (em milissegundos)
  #expirationTime = 5 * 60 * 1000; // 5 minutos padrão
  
  // Para emitir eventos
  #emitter = new EventEmitter();
  
  /**
   * Construtor privado, seguindo padrão Singleton
   */
  constructor() {
    // Registrar uma limpeza periódica da cache de dados expirados
    setInterval(() => this.#cleanupExpiredData(), 30000); // Limpar a cada 30 segundos
    
    // Configurar manipulador de debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      this.#emitter.on('debug', (message) => {
        console.debug(`[RouletteService] ${message}`);
      });
    }
  }
  
  /**
   * Obtém a única instância do serviço (Singleton)
   * @returns {RouletteService} A instância do serviço
   */
  static getInstance() {
    if (!RouletteService.instance) {
      RouletteService.instance = new RouletteService();
    }
    return RouletteService.instance;
  }
  
  /**
   * Gera um ID único para um item de dados
   * @param {Object} data Dado de roleta a ser processado 
   * @returns {string} ID único para o dado
   */
  #generateDataId(data) {
    if (!data) return '';
    
    // Diferentes tipos de dados podem ter diferentes formatos
    // Precisamos extrair identificadores consistentes
    
    let idParts = [];
    
    // ID da roleta (obrigatório)
    if (data.id) {
      idParts.push(`r:${data.id}`);
    }
    
    // Se tiver um número, extrair informações do último número
    if (data.numero && Array.isArray(data.numero) && data.numero.length > 0) {
      const lastNumber = data.numero[0];
      
      // Número
      const num = lastNumber.numero || lastNumber.number || 0;
      idParts.push(`n:${num}`);
      
      // Timestamp (se disponível)
      if (lastNumber.timestamp) {
        idParts.push(`t:${lastNumber.timestamp}`);
      }
    }
    
    // Juntar todas as partes para criar um ID único
    return idParts.join('|');
  }
  
  /**
   * Processa dados de roleta, evitando duplicações
   * @param {Array} data Array de dados de roletas
   * @param {string} source Identificador da fonte de dados (api, websocket, etc)
   * @returns {Array} Dados filtrados, sem duplicações
   */
  processRouletteData(data, source) {
    if (!data || !Array.isArray(data)) {
      console.warn('[RouletteService] Dados inválidos para processamento');
      return [];
    }
    
    // Registrar esta fonte como ativa
    this.#activeDataSources.add(source);
    
    const now = Date.now();
    const uniqueItems = [];
    const debug = process.env.NODE_ENV !== 'production';
    
    // Para cada item, verificar se já foi processado
    for (const item of data) {
      if (!item) continue;
      
      // Gerar ID único para o item
      const itemId = this.#generateDataId(item);
      
      // Se não temos ID válido, ignorar
      if (!itemId) continue;
      
      // Verificar se já processamos este ID
      if (this.#processedDataIds.has(itemId)) {
        if (debug) {
          this.#emitter.emit('debug', `Item de ID ${itemId} já processado anteriormente`);
        }
        continue;
      }
      
      // Registrar como processado com timestamp de expiração
      this.#processedDataIds.set(itemId, now + this.#expirationTime);
      
      // Agendar expiração do ID
      this.#scheduleIdExpiration(itemId, this.#expirationTime);
      
      // Adicionar à lista de itens únicos
      uniqueItems.push(item);
    }
    
    if (debug && uniqueItems.length > 0) {
      this.#emitter.emit('debug', `Processados ${uniqueItems.length} itens únicos de ${data.length} da fonte ${source}`);
    }
    
    return uniqueItems;
  }
  
  /**
   * Agenda a expiração de um ID de dados após um tempo específico
   * @param {string} id ID único do dado
   * @param {number} expirationTime Tempo para expiração em milissegundos
   */
  #scheduleIdExpiration(id, expirationTime) {
    setTimeout(() => {
      // Remover se ainda existir e não foi atualizado
      if (this.#processedDataIds.has(id)) {
        this.#processedDataIds.delete(id);
        this.#emitter.emit('debug', `Expirado ID ${id}`);
      }
    }, expirationTime);
  }
  
  /**
   * Limpa dados expirados da cache
   */
  #cleanupExpiredData() {
    const now = Date.now();
    let expiredCount = 0;
    
    // Verificar cada ID e remover os expirados
    for (const [id, expirationTime] of this.#processedDataIds.entries()) {
      if (now >= expirationTime) {
        this.#processedDataIds.delete(id);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0 && process.env.NODE_ENV !== 'production') {
      this.#emitter.emit('debug', `Limpeza automática: removidos ${expiredCount} IDs expirados`);
    }
  }
  
  /**
   * Verifica se uma fonte de dados está ativa
   * @param {string} source Identificador da fonte
   * @returns {boolean} true se a fonte está ativa
   */
  isDataSourceActive(source) {
    return this.#activeDataSources.has(source);
  }
  
  /**
   * Limpa a cache de dados processados
   */
  clearProcessedDataCache() {
    this.#processedDataIds.clear();
    this.#emitter.emit('debug', 'Cache de dados processados limpa');
  }
  
  /**
   * Define o tempo de expiração para dados processados
   * @param {number} timeMs Tempo em milissegundos
   */
  setExpirationTime(timeMs) {
    if (typeof timeMs === 'number' && timeMs > 0) {
      this.#expirationTime = timeMs;
    }
  }
  
  /**
   * Registra um ouvinte para eventos de debug
   * @param {Function} listener Função ouvinte para eventos de debug
   */
  onDebug(listener) {
    if (typeof listener === 'function') {
      this.#emitter.on('debug', listener);
    }
  }
}

export default RouletteService; 