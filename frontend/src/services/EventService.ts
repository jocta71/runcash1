// Serviço para gerenciar eventos em tempo real usando REST API
import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import { fetchWithCorsSupport } from '../utils/api-helpers';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Definição dos tipos de eventos
export interface RouletteNumberEvent {
  type: 'new_number';
  roleta_id: string;
  roleta_nome: string;
  numero: number;
  timestamp: string;
  // Campos opcionais de estratégia
  estado_estrategia?: string;
  sugestao_display?: string;
  terminais_gatilho?: number[];
  // Flag para indicar se dados existentes devem ser preservados
  preserve_existing?: boolean;
  // Flag para indicar se é uma atualização em tempo real (após carregamento inicial)
  realtime_update?: boolean;
}

export interface StrategyUpdateEvent {
  type: 'strategy_update';
  roleta_id: string;
  roleta_nome: string;
  estado: string;
  numero_gatilho: number;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
  timestamp?: string;
}

export interface ConnectedEvent {
  type: 'connected';
  message: string;
}

export type EventData = RouletteNumberEvent | ConnectedEvent | StrategyUpdateEvent;

// Tipo para callbacks de eventos
export type RouletteEventCallback = (event: RouletteNumberEvent | StrategyUpdateEvent) => void;

// Tipo para callbacks de eventos genéricos
export type EventCallback = (data: any) => void;

// Interface para SocketService
export interface ISocketService {
  subscribe(roletaNome: string, callback: RouletteEventCallback): void;
  unsubscribe(roletaNome: string, callback: RouletteEventCallback): void;
  isSocketConnected(): boolean;
  disconnect(): void;
  requestRecentNumbers(): void;
}

export class EventService {
  private static instance: EventService | null = null;
  private static isInitializing = false;

  private eventListeners: Record<string, Function[]> = {};
  private globalEventListeners: Record<string, Function[]> = {};
  private socketServiceInstance: ISocketService | null = null;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private isConnected: boolean = false;
  private pollingActive: boolean = false;
  private pollingInterval: number | null = null;
  
  // Map para armazenar callbacks de eventos personalizados
  private customEventListeners: Map<string, Set<EventCallback>> = new Map();

  private constructor() {
    if (EventService.instance) {
      throw new Error('Erro: Tentativa de criar uma nova instância do EventService. Use EventService.getInstance()');
    }
    
    // Inicialização padrão
    this.eventListeners = {};
    this.globalEventListeners = {};
    
    // Adicionar listener global para logging de todos os eventos
    this.subscribe('*', (event: RouletteNumberEvent) => {
      debugLog(`[EventService][GLOBAL] Evento: ${event.roleta_nome}, número: ${event.numero}`);
    });
    
    // Carregar SocketService dinamicamente após inicialização
    setTimeout(() => {
      this.loadSocketService();
    }, 100);
    
    // Adicionar listener para visibilidade da página
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Carrega o SocketService de forma dinâmica para evitar dependência circular
   */
  private loadSocketService(): void {
    try {
      // Importar dinamicamente para evitar ciclo de dependência
      import('@/services/SocketService').then(module => {
        // O módulo importado tem uma propriedade 'default' que é o singleton já instanciado
        const socketService = module.default;
        
        if (socketService) {
          this.socketServiceInstance = socketService;
          debugLog('[EventService] SocketService carregado com sucesso');
          this.isConnected = true;
          
          toast({
            title: "Conexão de dados",
            description: "Usando REST API para receber atualizações",
            variant: "default"
          });
        } else {
          console.error('[EventService] SocketService carregado, mas instância não encontrada');
        }
      }).catch(error => {
        console.error('[EventService] Erro ao carregar SocketService:', error);
      });
    } catch (error) {
      console.error('[EventService] Erro ao importar SocketService:', error);
    }
  }

  /**
   * Obtém a única instância do EventService (Singleton)
   * Implementa um mecanismo que previne múltiplas instâncias mesmo com chamadas paralelas
   */
  public static getInstance(): EventService {
    // Se já existe uma instância, retorna imediatamente
    if (EventService.instance) {
      return EventService.instance;
    }

    // Se já está inicializando, aguarde
    if (EventService.isInitializing) {
      console.log('[EventService] Inicialização em andamento, aguardando...');
      // Não tentamos retornar a promise de inicialização, pois não é utilizada corretamente
      // Apenas retornamos a instância, que deve estar definida neste ponto
      return EventService.instance as EventService;
    }

    // Inicia o processo de inicialização
    EventService.isInitializing = true;
    
    // Cria instância apenas se ainda não existir
    if (!EventService.instance) {
      console.log('[EventService] Criando nova instância');
      EventService.instance = new EventService();
    }
    
    // Libera o flag de inicialização
    EventService.isInitializing = false;
    
    return EventService.instance;
  }

  // Cleanup quando o serviço é destruído
  public destroy() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.disconnect();
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Tentar reconectar se a página ficar visível e não estiver conectado
      if (!this.isConnected) {
        debugLog('[EventService] Página tornou-se visível, reconectando...');
        this.loadSocketService();
      }
    }
  }

  /**
   * Inicia polling para obter dados periódicos
   */
  private startPolling(): void {
    if (this.pollingActive) {
      return; // Já está em polling
    }
    
    this.pollingActive = true;
    
    // Usar um intervalo de 15 segundos para polling
    this.pollingInterval = window.setInterval(() => {
      this.performPoll();
    }, 15000) as unknown as number;
    
    // Executar imediatamente a primeira vez
    this.performPoll();
  }

  /**
   * Executa uma requisição de poll
   */
  private async performPoll(): Promise<void> {
    try {
      debugLog('[EventService] Executando polling para obter dados recentes');
      
      // Buscar roletas disponíveis
      const roletasResponse = await fetchWithCorsSupport<any[]>('/ROULETTES');
      
      if (roletasResponse && Array.isArray(roletasResponse)) {
        for (const roleta of roletasResponse) {
          const roletaId = roleta._id || roleta.id;
          const roletaNome = roleta.nome || roleta.name;
          
          if (roletaId) {
            // Buscar números recentes para cada roleta
            const numerosResponse = await fetchWithCorsSupport<any[]>(`/ROULETTE_NUMBERS/${roletaId}?limit=10`);
            
            if (numerosResponse && Array.isArray(numerosResponse) && numerosResponse.length > 0) {
              // Processar apenas o número mais recente como evento
              const numeroRecente = numerosResponse[0];
              const numero = parseInt(numeroRecente.numero || numeroRecente.number || '0', 10);
              const timestamp = numeroRecente.timestamp || numeroRecente.created_at || new Date().toISOString();
              
              // Criar e emitir evento
              const event: RouletteNumberEvent = {
                type: 'new_number',
                roleta_id: roletaId,
                roleta_nome: roletaNome,
                numero,
                timestamp,
                realtime_update: true
              };
              
              this.notifyListeners(event);
            }
          }
        }
      }
    } catch (error) {
      console.error('[EventService] Erro durante polling:', error);
    }
  }

  /**
   * Inscreve um componente para receber atualizações
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
    }
    
    console.log(`[EventService] Novo assinante para roleta: ${roletaNome}`);
    this.listeners.get(roletaNome)?.add(callback);
    
    // Iniciar polling se não estiver ativo
    if (!this.pollingActive) {
      this.startPolling();
    }
    
    // Se estamos usando o SocketService, inscrever também lá
    if (this.socketServiceInstance) {
      this.socketServiceInstance.subscribe(roletaNome, callback);
    }
  }
  
  /**
   * Cancela a inscrição de um componente
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    if (this.listeners.has(roletaNome)) {
      this.listeners.get(roletaNome)?.delete(callback);
      console.log(`[EventService] Inscrição cancelada para roleta: ${roletaNome}`);
    }
    
    // Caso esteja usando o socketService, remover também lá
    if (this.socketServiceInstance) {
      this.socketServiceInstance.unsubscribe(roletaNome, callback);
    }
  }

  /**
   * Notifica os ouvintes inscritos
   */
  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    try {
      // Obter os ouvintes específicos para esta roleta
      const specificListeners = this.listeners.get(event.roleta_nome);
      
      // Obter os ouvintes globais (*)
      const globalListeners = this.listeners.get('*');
      
      // Notificar ouvintes específicos
      if (specificListeners && specificListeners.size > 0) {
        specificListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[EventService] Erro ao chamar callback específico:', error);
          }
        });
      }
      
      // Notificar ouvintes globais
      if (globalListeners && globalListeners.size > 0) {
        globalListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[EventService] Erro ao chamar callback global:', error);
          }
        });
      }
    } catch (error) {
      console.error('[EventService] Erro ao notificar ouvintes:', error);
    }
  }

  /**
   * Verifica o status da conexão
   */
  public isSocketConnected(): boolean {
    return this.isConnected || (this.socketServiceInstance?.isSocketConnected() || false);
  }
  
  /**
   * Desconecta o serviço
   */
  public disconnect(): void {
    console.log('[EventService] Desconectando serviço de eventos');
    
    // Parar polling
    if (this.pollingInterval) {
      window.clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollingActive = false;
    }
    
    // Desconectar o SocketService se estiver sendo usado
    if (this.socketServiceInstance) {
      this.socketServiceInstance.disconnect();
    }
    
    this.isConnected = false;
  }

  /**
   * Solicita atualizações em tempo real
   */
  public requestRealtimeUpdates(): void {
    console.log('[EventService] Solicitando atualizações em tempo real via REST');
    
    if (this.socketServiceInstance) {
      this.socketServiceInstance.requestRecentNumbers();
    } else {
      // Se não tiver SocketService, fazer polling direto
      this.performPoll();
    }
  }

  // Métodos estáticos para eventos personalizados (mantidos para compatibilidade)
  
  /**
   * Registra um callback para um tipo de evento personalizado
   */
  public static on(eventName: string, callback: EventCallback): void {
    const service = this.getInstance();
    
    if (!service.customEventListeners.has(eventName)) {
      service.customEventListeners.set(eventName, new Set());
    }
    
    service.customEventListeners.get(eventName)?.add(callback);
  }
  
  /**
   * Remove um callback de um tipo de evento personalizado
   */
  public static off(eventName: string, callback: EventCallback): void {
    const service = this.getInstance();
    
    if (service.customEventListeners.has(eventName)) {
      service.customEventListeners.get(eventName)?.delete(callback);
    }
  }
  
  /**
   * Emite um evento personalizado
   */
  public static emit(eventName: string, data: any): void {
    const service = this.getInstance();
    
    if (service.customEventListeners.has(eventName)) {
      service.customEventListeners.get(eventName)?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventService] Erro ao chamar callback para evento ${eventName}:`, error);
        }
      });
    }
  }
}

// Exportar a instância para uso direto
export default EventService.getInstance(); 