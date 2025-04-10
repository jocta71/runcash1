import { getLogger } from './utils/logger';
import EventService from './EventService';
import { RouletteData, RouletteNumberEvent } from '@/types';
import config from '@/config/env';

const logger = getLogger('RouletteStreamService');

/**
 * Serviço para conectar ao endpoint de streaming de dados da API REST
 * Utiliza Server-Sent Events (SSE) para receber atualizações em tempo real
 */
export default class RouletteStreamService {
  private static instance: RouletteStreamService | null = null;
  private eventSource: EventSource | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number | null = null;
  private baseApiUrl: string = '';
  
  // Cache local de dados
  private rouletteDataCache: Map<string, RouletteData> = new Map();
  
  private constructor() {
    // Usar o endpoint específico do Railway
    this.baseApiUrl = 'https://backendapi-production-36b5.up.railway.app';
    this.setupVisibilityChangeListener();
  }
  
  /**
   * Obtém a instância única do serviço
   */
  public static getInstance(): RouletteStreamService {
    if (!RouletteStreamService.instance) {
      RouletteStreamService.instance = new RouletteStreamService();
    }
    return RouletteStreamService.instance;
  }
  
  /**
   * Configura listener para mudanças de visibilidade da página
   * Isso permite reconectar quando a página volta a ficar visível
   */
  private setupVisibilityChangeListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!this.isConnected) {
          logger.info('👁️ Página visível, reconectando ao stream');
          this.connect();
        }
      } else {
        // Desconecta quando a página não está visível para economizar recursos
        logger.info('🔒 Página em segundo plano, desconectando do stream');
        this.disconnect();
      }
    });
  }
  
  /**
   * Conecta ao endpoint de streaming da API
   */
  public connect(): void {
    if (this.isConnected || this.eventSource) {
      logger.info('Já conectado ao stream, ignorando nova conexão');
      return;
    }
    
    try {
      logger.info('🔌 Conectando ao endpoint de streaming...');
      
      // Cria uma conexão SSE com o endpoint de streaming
      // Usando o endpoint existente e adicionando o parâmetro stream=true
      const url = `${this.baseApiUrl}/api/ROULETTES?stream=true`;
      this.eventSource = new EventSource(url);
      
      // Configura handlers de eventos
      this.eventSource.onopen = () => {
        logger.success('✅ Conexão de streaming estabelecida');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Notificar sobre a conexão bem sucedida
        EventService.emit('roulette:stream-connected', {
          timestamp: new Date().toISOString()
        });
      };
      
      // Handler para mensagens recebidas
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleStreamData(data);
        } catch (error) {
          logger.error('❌ Erro ao processar mensagem do stream:', error);
        }
      };
      
      // Handler específico para novos números
      this.eventSource.addEventListener('new_number', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          this.handleNewNumber(data);
        } catch (error) {
          logger.error('❌ Erro ao processar evento de novo número:', error);
        }
      });
      
      // Handler específico para atualizações de roletas
      this.eventSource.addEventListener('roulette_update', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          this.handleRouletteUpdate(data);
        } catch (error) {
          logger.error('❌ Erro ao processar atualização de roleta:', error);
        }
      });
      
      // Handler para erros
      this.eventSource.onerror = (error) => {
        logger.error('❌ Erro na conexão de streaming:', error);
        this.isConnected = false;
        
        // Fechar conexão atual
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        
        // Tentar reconexão com backoff exponencial
        this.attemptReconnect();
        
        // Notificar sobre o erro de conexão
        EventService.emit('roulette:stream-error', {
          timestamp: new Date().toISOString(),
          error: 'Conexão de streaming perdida'
        });
      };
    } catch (error) {
      logger.error('❌ Erro ao iniciar conexão de streaming:', error);
      this.isConnected = false;
      this.attemptReconnect();
    }
  }
  
  /**
   * Desconecta do endpoint de streaming
   */
  public disconnect(): void {
    if (!this.eventSource) {
      return;
    }
    
    try {
      logger.info('Desconectando do stream...');
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      
      // Limpar qualquer tentativa pendente de reconexão
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Notificar sobre a desconexão
      EventService.emit('roulette:stream-disconnected', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('❌ Erro ao desconectar do stream:', error);
    }
  }
  
  /**
   * Tenta reconectar ao endpoint de streaming com backoff exponencial
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(`⚠️ Máximo de ${this.maxReconnectAttempts} tentativas de reconexão atingido`);
      
      // Notificar sobre falha na reconexão
      EventService.emit('roulette:stream-reconnect-failed', {
        timestamp: new Date().toISOString()
      });
      
      return;
    }
    
    // Calcular tempo de espera com backoff exponencial
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    logger.info(`🔄 Tentando reconectar em ${delay/1000} segundos (tentativa ${this.reconnectAttempts + 1})`);
    
    // Agendar tentativa de reconexão
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }
  
  /**
   * Processa dados recebidos do stream
   */
  private handleStreamData(data: any): void {
    // Verificar se os dados são válidos
    if (!data || (Array.isArray(data) && data.length === 0)) {
      logger.warn('⚠️ Recebidos dados vazios do stream');
      return;
    }
    
    logger.debug(`📦 Dados recebidos do stream:`, data);
    
    // Atualizar cache com os dados recebidos
    if (Array.isArray(data)) {
      // Caso seja uma lista de roletas
      data.forEach(roulette => {
        if (roulette && roulette.id) {
          this.updateRouletteCache(roulette);
        }
      });
    } else if (data && data.id) {
      // Caso seja uma única roleta
      this.updateRouletteCache(data);
    }
    
    // Emitir evento para notificar componentes
    EventService.emit('roulette:data-updated', {
      timestamp: new Date().toISOString(),
      source: 'stream'
    });
  }
  
  /**
   * Processa evento de novo número
   */
  private handleNewNumber(data: RouletteNumberEvent): void {
    if (!data || !data.roleta_id) {
      logger.warn('⚠️ Evento de número inválido:', data);
      return;
    }
    
    logger.info(`🎲 Novo número recebido para ${data.roleta_nome || data.roleta_id}: ${data.numero}`);
    
    // Atualizar o cache com o novo número
    const cachedRoulette = this.rouletteDataCache.get(data.roleta_id);
    if (cachedRoulette) {
      // Se for um número único
      if (typeof data.numero === 'number') {
        // Adicionar o novo número ao início da lista
        cachedRoulette.lastNumbers = [data.numero, ...(cachedRoulette.lastNumbers || [])].slice(0, 50);
      } 
      // Se for uma lista de números
      else if (Array.isArray(data.numero)) {
        cachedRoulette.lastNumbers = [...data.numero, ...(cachedRoulette.lastNumbers || [])].slice(0, 50);
      }
      
      // Atualizar cache
      this.rouletteDataCache.set(data.roleta_id, cachedRoulette);
    }
    
    // Emitir evento de novo número
    EventService.emit('roulette:new-number', data);
  }
  
  /**
   * Processa atualização de informações da roleta
   */
  private handleRouletteUpdate(data: any): void {
    if (!data || !data.id) {
      logger.warn('⚠️ Atualização de roleta inválida:', data);
      return;
    }
    
    logger.info(`📊 Atualização recebida para roleta ${data.name || data.id}`);
    
    // Atualizar cache com os novos dados
    this.updateRouletteCache(data);
    
    // Emitir evento de atualização
    EventService.emit('roulette:updated', data);
  }
  
  /**
   * Atualiza o cache local com dados da roleta
   */
  private updateRouletteCache(roulette: RouletteData): void {
    if (!roulette || !roulette.id) return;
    
    const cachedRoulette = this.rouletteDataCache.get(roulette.id) || {};
    
    // Mesclar dados novos com existentes
    const updatedRoulette = {
      ...cachedRoulette,
      ...roulette,
      lastUpdate: new Date().toISOString()
    };
    
    // Assegurar que lastNumbers é sempre um array
    if (!updatedRoulette.lastNumbers) {
      updatedRoulette.lastNumbers = [];
    }
    
    // Atualizar cache
    this.rouletteDataCache.set(roulette.id, updatedRoulette);
  }
  
  /**
   * Obtém dados de uma roleta específica do cache
   */
  public getRouletteData(roletaId: string): RouletteData | null {
    return this.rouletteDataCache.get(roletaId) || null;
  }
  
  /**
   * Obtém todas as roletas do cache
   */
  public getAllRoulettes(): RouletteData[] {
    return Array.from(this.rouletteDataCache.values());
  }
  
  /**
   * Verifica se o serviço está conectado ao stream
   */
  public isStreamConnected(): boolean {
    return this.isConnected;
  }
}
