/**
 * UnifiedRouletteClient
 * 
 * Cliente unificado para dados de roletas que combina:
 * 1. Streaming (SSE) para atualizações em tempo real
 * 2. REST API para acesso a dados estáticos ou como fallback
 * 
 * Este serviço ajuda a evitar chamadas duplicadas garantindo que todas as partes
 * do aplicativo usem a mesma fonte de dados.
 */

import { ENDPOINTS } from '@/services/api/endpoints';
import EventBus from './EventBus';
import cryptoService from '../utils/crypto-service';
import axios from 'axios';
import eventService from './EventService';
const EventService = eventService;
import config from '@/config/env';
import { toast } from '@/components/ui/use-toast';
import { Roulette, RouletteWithLatestNumbers } from '@/types/roulette';
import GlobalRouletteDataService from '@/services/GlobalRouletteDataService';

// Tipos para callbacks de eventos
type EventCallback = (data: any) => void;
type Unsubscribe = () => void;

// Interface para opções de configuração
interface RouletteClientOptions {
  // Opções para streaming
  streamingEnabled?: boolean;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  
  // Opções para polling fallback
  enablePolling?: boolean;
  pollingInterval?: number;
  
  // Opções gerais
  enableLogging?: boolean;
  cacheTTL?: number;
}

// Interface para resposta da API
interface ApiResponse<T> {
  error: boolean;
  data?: T;
  message?: string;
  code?: string;
  statusCode?: number;
}

// Interface para dados históricos (adaptar se necessário)
interface RouletteNumber {
  numero: number;
  timestamp: string; // ou Date
}

// Eventos emitidos pelo cliente unificado
export enum UnifiedRouletteEvents {
  DATA_UPDATED = 'unified_roulette_data_updated',
  CONNECTION_STATUS_CHANGED = 'unified_roulette_connection_status',
  ERROR = 'unified_roulette_error',
}

/**
 * Cliente unificado para gerenciamento de dados de roletas
 * Combina poll e streaming para garantir dados atualizados
 */
export class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient;
  private eventSource: EventSource | null = null;
  private rouletteDataCache: Map<string, RouletteWithLatestNumbers> = new Map();
  private isPolling = false;
  private pollingInterval = 3000;
  private pollingTimeoutId: number | null = null;
  private connectedClients = 0;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  
  private constructor() {
    this.setupStreamConnection();
  }
  
  /**
   * Obtém a instância única do cliente
   */
  public static getInstance(): UnifiedRouletteClient {
    if (!UnifiedRouletteClient.instance) {
      UnifiedRouletteClient.instance = new UnifiedRouletteClient();
    }
    return UnifiedRouletteClient.instance;
  }
  
  /**
   * Conecta um componente ao cliente
   * Inicia o streaming e/ou polling conforme necessário
   * @param componentId ID único do componente
   */
  public connect(componentId: string): void {
    this.connectedClients++;
    
    if (this.connectedClients === 1) {
      // Este é o primeiro cliente, iniciar a conexão
      this.setupStreamConnection();
      this.startPolling();
    }
    
    // Notificar o componente com os dados existentes no cache
    if (this.rouletteDataCache.size > 0) {
      const cachedData = Array.from(this.rouletteDataCache.values());
      this.emitEvent(UnifiedRouletteEvents.DATA_UPDATED, cachedData);
    }
  }
  
  /**
   * Desconecta um componente do cliente
   * Se não houver mais componentes, interromper conexões
   * @param componentId ID único do componente
   */
  public disconnect(componentId: string): void {
    this.connectedClients = Math.max(0, this.connectedClients - 1);
    
    if (this.connectedClients === 0) {
      // Não há mais clientes, desconectar
      this.stopPolling();
      this.closeStreamConnection();
    }
  }
  
  /**
   * Configura a conexão de streaming com o servidor
   */
  private setupStreamConnection(): void {
    // Fechar qualquer conexão existente
    this.closeStreamConnection();
    
    try {
      console.log('Iniciando conexão SSE para dados de roletas');
      this.eventSource = new EventSource(ENDPOINTS.STREAM.ROULETTES);
      
      this.eventSource.onopen = () => {
        console.log('Conexão SSE estabelecida com sucesso');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emitEvent(UnifiedRouletteEvents.CONNECTION_STATUS_CHANGED, true);
      };
      
      this.eventSource.onmessage = (event) => {
        this.handleStreamUpdate(event);
      };
      
      this.eventSource.onerror = (error) => {
        console.error('Erro na conexão SSE:', error);
        this.isConnected = false;
        this.emitEvent(UnifiedRouletteEvents.CONNECTION_STATUS_CHANGED, false);
        this.emitEvent(UnifiedRouletteEvents.ERROR, error);
        
        // Reconectar com estratégia de backoff
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Falha ao criar conexão SSE:', error);
      this.emitEvent(UnifiedRouletteEvents.ERROR, error);
      
      // Iniciar polling como fallback
      this.startPolling();
    }
  }
  
  /**
   * Tenta reconectar ao stream após uma desconexão
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`Máximo de ${this.maxReconnectAttempts} tentativas de reconexão atingido. Usando polling como fallback.`);
      this.startPolling();
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Tentativa de reconexão ${this.reconnectAttempts} em ${delay}ms`);
    
    setTimeout(() => {
      this.setupStreamConnection();
    }, delay);
  }
  
  /**
   * Fecha a conexão de streaming
   */
  private closeStreamConnection(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }
  
  /**
   * Inicia polling para dados de roletas
   * Usado como fallback quando streaming não está disponível
   */
  private startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.pollData();
  }
  
  /**
   * Interrompe o polling de dados
   */
  private stopPolling(): void {
    this.isPolling = false;
    
    if (this.pollingTimeoutId !== null) {
      clearTimeout(this.pollingTimeoutId);
      this.pollingTimeoutId = null;
    }
  }
  
  /**
   * Realiza o polling de dados como fallback
   */
  private pollData(): void {
    if (!this.isPolling) return;
    
    GlobalRouletteDataService.getAllRoulettes()
      .then(data => {
        // Atualizar o cache com os dados recebidos
        if (data && Array.isArray(data)) {
          data.forEach(roulette => {
            this.updateRouletteCache(roulette);
          });
          
          // Emitir evento com todos os dados do cache
          const allData = Array.from(this.rouletteDataCache.values());
          this.emitEvent(UnifiedRouletteEvents.DATA_UPDATED, allData);
        }
      })
      .catch(error => {
        console.error('Erro ao fazer polling de dados:', error);
        this.emitEvent(UnifiedRouletteEvents.ERROR, error);
      })
      .finally(() => {
        // Continuar o polling após o intervalo definido
        if (this.isPolling) {
          this.pollingTimeoutId = setTimeout(() => this.pollData(), this.pollingInterval) as unknown as number;
        }
      });
  }
  
  /**
   * Processa uma atualização recebida via streaming
   * @param event Evento SSE recebido
   */
  private handleStreamUpdate(event: MessageEvent): void {
    try {
      console.log('Dados recebidos via SSE:', event.data);
      const data = JSON.parse(event.data);
      
      // Verificar se temos um formato compatível
      if (Array.isArray(data)) {
        // Processar array de roletas
        data.forEach(roulette => {
          this.updateRouletteCache(roulette);
        });
      } else if (data.id) {
        // Processar uma única roleta
        this.updateRouletteCache(data);
      } else {
        console.warn('Formato de dados desconhecido recebido via SSE:', data);
        return;
      }
      
      // Emitir evento com todos os dados atualizados
      const allData = Array.from(this.rouletteDataCache.values());
      this.emitEvent(UnifiedRouletteEvents.DATA_UPDATED, allData);
    } catch (error) {
      console.error('Erro ao processar atualização via SSE:', error, 'Dados brutos:', event.data);
      this.emitEvent(UnifiedRouletteEvents.ERROR, error);
    }
  }
  
  /**
   * Atualiza o cache interno com os dados de uma roleta
   * @param roulette Dados da roleta a serem atualizados
   */
  private updateRouletteCache(roulette: Roulette | RouletteWithLatestNumbers): void {
    if (!roulette || !roulette.id) {
      console.warn('Tentativa de atualizar cache com dados inválidos:', roulette);
      return;
    }
    
    // Se já temos este item no cache, preservar os números anteriores
    const existing = this.rouletteDataCache.get(roulette.id);
    
    // Criar um novo objeto com os dados atualizados
    const updated: RouletteWithLatestNumbers = {
      ...roulette,
      // Garantir que temos o array de números mais recentes
      latestNumbers: ('latestNumbers' in roulette && Array.isArray(roulette.latestNumbers)) 
        ? roulette.latestNumbers 
        : (existing?.latestNumbers || [])
    };
    
    // Verificar se os números foram atualizados
    if ('latestNumber' in roulette && roulette.latestNumber) {
      // Adicionar o número mais recente ao início do array
      if (!updated.latestNumbers) {
        updated.latestNumbers = [];
      }
      
      // Evitar duplicação do último número
      const lastNumber = roulette.latestNumber;
      if (updated.latestNumbers.length === 0 || updated.latestNumbers[0] !== lastNumber) {
        updated.latestNumbers.unshift(lastNumber);
        
        // Manter apenas os 10 números mais recentes
        if (updated.latestNumbers.length > 10) {
          updated.latestNumbers = updated.latestNumbers.slice(0, 10);
        }
      }
    }
    
    // Atualizar timestamp
    updated.timestamp = new Date().toISOString();
    
    // Atualizar o cache
    this.rouletteDataCache.set(roulette.id, updated);
  }
  
  /**
   * Emite um evento para subscribers
   * @param eventName Nome do evento a ser emitido
   * @param data Dados a serem enviados com o evento
   */
  private emitEvent(eventName: UnifiedRouletteEvents, data: any): void {
    // Usar o EventService global para emitir o evento de forma segura
    try {
      if (window.EventService && typeof window.EventService.emit === 'function') {
        window.EventService.emit(eventName, data);
      } else {
        console.warn('EventService global não disponível ou método emit não encontrado');
      }
    } catch (error) {
      console.error('Erro ao emitir evento:', eventName, error);
    }
  }
  
  /**
   * Retorna todos os dados atuais do cache
   */
  public getAllRoulettes(): RouletteWithLatestNumbers[] {
    return Array.from(this.rouletteDataCache.values());
  }
  
  /**
   * Obtém uma roleta específica pelo ID
   * @param id ID da roleta a ser obtida
   */
  public getRoulette(id: string): RouletteWithLatestNumbers | undefined {
    return this.rouletteDataCache.get(id);
  }
  
  /**
   * Verifica se há dados no cache
   */
  public hasData(): boolean {
    return this.rouletteDataCache.size > 0;
  }
  
  /**
   * Retorna o status atual da conexão
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
  
  /**
   * Inscreve um callback para receber eventos
   * @param event Tipo de evento
   * @param callback Função a ser chamada quando o evento ocorrer
   */
  public subscribe(event: UnifiedRouletteEvents, callback: Function): void {
    if (window.EventService && typeof window.EventService.on === 'function') {
      window.EventService.on(event, callback);
    } else {
      console.warn('EventService global não disponível para inscrição em:', event);
    }
  }
  
  /**
   * Remove um callback inscrito
   * @param event Tipo de evento
   * @param callback Função a ser removida
   */
  public unsubscribe(event: UnifiedRouletteEvents, callback: Function): void {
    if (window.EventService && typeof window.EventService.off === 'function') {
      window.EventService.off(event, callback);
    }
  }
}

// Criar uma instância global para facilitar uso
const unifiedClient = UnifiedRouletteClient.getInstance();
export default unifiedClient;