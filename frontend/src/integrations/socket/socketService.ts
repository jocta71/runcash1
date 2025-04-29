import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, isProduction } from '../../config/env';
import { RouletteNumberEvent } from '../../types/events';

// Tipos de eventos
export interface RouletteEvent {
  type: string;
  roleta_id: string;
  roleta_nome: string;
  [key: string]: any;
}

export type RouletteEventCallback = (event: RouletteEvent) => void;

/**
 * Serviço que gerencia a conexão WebSocket com suporte a modo de simulação
 * para funcionar mesmo quando o servidor WebSocket não está disponível
 */
class SocketService {
  private static instance: SocketService | null = null;
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  private simulationMode: boolean = false;
  private socketUrl: string;
  private eventListeners: Record<string, RouletteEventCallback[]> = {
    'connect': [],
    'disconnect': [],
    'message': []
  };
  private routeSubscriptions: Map<string, Set<RouletteEventCallback>> = new Map();

  private constructor() {
    console.log('[SocketService] Inicializando serviço de socket');
    this.socketUrl = this.getSocketUrl();
    console.log(`[Socket] Inicializando serviço. URL: ${this.socketUrl}`);
    
    // Verificar se devemos iniciar em modo de simulação imediatamente
    // Adicionando verificação para URLs que sabemos que estão causando problemas
    if (!this.socketUrl || 
        this.socketUrl.includes('localhost') || 
        this.socketUrl.includes('railway.app')) {
      console.log('[Socket] Iniciando diretamente em modo de simulação (URL problemática)');
      this.simulationMode = true;
      this.isConnected = true;
      return;
    }
    
    this.connect();
    
    // Carregar dados históricos imediatamente
    this.loadHistoricalRouletteNumbers();
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Conecta ao servidor de WebSocket ou ativa modo de simulação caso não seja possível
   */
  public connect(): void {
    if (!this.socket) {
      try {
        console.log(`[Socket] Tentando conectar ao websocket: ${this.socketUrl}`);
        
        // Determinar se devemos usar a URL do servidor ou um fallback de simulação
        if (!this.socketUrl || this.socketUrl.includes('localhost') || this.simulationMode) {
          console.log('[Socket] Usando modo de simulação para WebSocket');
          this.simulationMode = true;
          this.isConnected = true;
          
          // Emitir evento de conexão para os listeners
          this.eventListeners['connect']?.forEach(listener => listener({
            type: 'connect',
            roleta_id: '',
            roleta_nome: '',
            message: 'Conectado em modo de simulação'
          }));
          
          return;
        }
        
        // Iniciar socket real com reconexão limitada
        this.socket = io(this.socketUrl, {
          reconnectionAttempts: 5,           // Aumentar número de tentativas
          reconnectionDelay: 1000,           // Iniciar com 1s de delay
          reconnectionDelayMax: 10000,       // Aumentar para 10s de delay máximo
          timeout: 10000,                    // Aumentar o timeout para 10s
          autoConnect: true,
          transports: ['websocket', 'polling'], // Adicionar polling como fallback
          forceNew: true,                    // Forçar nova conexão
          pingTimeout: 30000,                // Aumentar ping timeout
          pingInterval: 10000                // Diminuir intervalo de ping
        });
        
        // Tratamento de eventos
        this.socket.on('connect', () => {
          console.log('[Socket] Conectado ao servidor');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.eventListeners['connect']?.forEach(listener => listener({
            type: 'connect',
            roleta_id: '',
            roleta_nome: '',
            message: 'Conectado ao servidor'
          }));
          
          // Solicitar dados recentes ao conectar
          this.requestRecentNumbers();
        });
        
        this.socket.on('disconnect', (reason) => {
          console.log(`[Socket] Desconectado do servidor. Motivo: ${reason}`);
          this.isConnected = false;
          this.eventListeners['disconnect']?.forEach(listener => listener({
            type: 'disconnect',
            roleta_id: '',
            roleta_nome: '',
            reason
          }));
        });
        
        this.socket.on('connect_error', (error) => {
          console.error(`[Socket] Erro de conexão: ${error.message}`);
          this.isConnected = false;
          
          // Após várias tentativas, ativar modo de simulação
          if (this.socket?.io?.reconnectionAttempts === 0) {
            console.log('[Socket] Número máximo de tentativas excedido. Ativando modo de simulação.');
            this.socket.disconnect();
            this.socket = null;
            this.simulationMode = true;
            this.isConnected = true;
            
            // Emitir evento de conexão para os listeners
            this.eventListeners['connect']?.forEach(listener => listener({
              type: 'connect',
              roleta_id: '',
              roleta_nome: '',
              message: 'Conectado em modo de simulação após falhas'
            }));
          }
        });
        
        // Configurar handlers para mensagens recebidas
        this.setupMessageListeners();
        
      } catch (error) {
        console.error(`[Socket] Erro ao conectar ao websocket: ${error}`);
        this.simulationMode = true;
        this.isConnected = true;
        
        // Emitir evento de conexão para os listeners
        this.eventListeners['connect']?.forEach(listener => listener({
          type: 'connect',
          roleta_id: '',
          roleta_nome: '',
          message: 'Conectado em modo de simulação após erro'
        }));
      }
    }
  }
  
  /**
   * Configura listeners para mensagens do servidor
   */
  private setupMessageListeners(): void {
    if (!this.socket || this.simulationMode) return;
    
    // Listeners para eventos do servidor
    this.socket.on('new_number', (data: any) => {
      console.log(`[Socket] Novo número recebido: ${data.roleta_nome} - ${data.numero}`);
      
      const event: RouletteEvent = {
        type: 'new_number',
        roleta_id: data.roleta_id,
        roleta_nome: data.roleta_nome,
        numero: data.numero,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      this.notifySubscribers(event);
    });
    
    this.socket.on('strategy_update', (data: any) => {
      console.log(`[Socket] Atualização de estratégia: ${data.roleta_nome}`);
      
      const event: RouletteEvent = {
        type: 'strategy_update',
        roleta_id: data.roleta_id,
        roleta_nome: data.roleta_nome,
        estado: data.estado,
        numero_gatilho: data.numero_gatilho,
        terminais_gatilho: data.terminais_gatilho,
        vitorias: data.vitorias,
        derrotas: data.derrotas,
        sugestao_display: data.sugestao_display,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      this.notifySubscribers(event);
    });
  }
  
  /**
   * Assina para receber eventos de uma roleta específica
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    console.log(`[Socket] Inscrevendo para eventos da roleta: ${roletaNome}`);
    
    if (!this.routeSubscriptions.has(roletaNome)) {
      this.routeSubscriptions.set(roletaNome, new Set());
      
      // Enviar subscrição ao servidor, se estiver conectado
      if (this.socket && !this.simulationMode) {
        this.socket.emit('subscribe_to_roleta', { roleta_nome: roletaNome });
      }
    }
    
    // Adicionar o callback ao set
    this.routeSubscriptions.get(roletaNome)?.add(callback);
  }
  
  /**
   * Cancela assinatura de eventos de uma roleta
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    console.log(`[Socket] Removendo inscrição para eventos da roleta: ${roletaNome}`);
    
    const callbacks = this.routeSubscriptions.get(roletaNome);
    if (callbacks) {
      callbacks.delete(callback);
      
      // Se não há mais callbacks, remove a entrada
      if (callbacks.size === 0) {
        this.routeSubscriptions.delete(roletaNome);
        
        // Informar ao servidor, se conectado
        if (this.socket && !this.simulationMode) {
          this.socket.emit('unsubscribe_from_roleta', { roleta_nome: roletaNome });
        }
      }
    }
  }
  
  /**
   * Notifica assinantes sobre eventos
   */
  private notifySubscribers(event: RouletteEvent): void {
    const { roleta_nome } = event;
    
    // Notificar assinantes desta roleta específica
    const callbacks = this.routeSubscriptions.get(roleta_nome);
    if (callbacks) {
      console.log(`[Socket] Notificando ${callbacks.size} assinantes para roleta: ${roleta_nome}`);
      callbacks.forEach(callback => callback(event));
    }
    
    // Notificar assinantes globais (*)
    const globalCallbacks = this.routeSubscriptions.get('*');
    if (globalCallbacks) {
      console.log(`[Socket] Notificando ${globalCallbacks.size} assinantes globais`);
      globalCallbacks.forEach(callback => callback(event));
    }
  }
  
  /**
   * Verifica se o socket está conectado
   */
  public isSocketConnected(): boolean {
    // No modo de simulação, sempre retornar conectado
    if (this.simulationMode) return true;
    
    return this.isConnected;
  }
  
  /**
   * Desconecta o socket
   */
  public disconnect(): void {
    if (this.socket && !this.simulationMode) {
      console.log('[Socket] Desconectando do WebSocket');
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    
    // Notificar listeners de desconexão
    this.eventListeners['disconnect']?.forEach(listener => listener({
      type: 'disconnect',
      roleta_id: '',
      roleta_nome: '',
      reason: 'manual_disconnect'
    }));
  }

  private getSocketUrl(): string {
    // Obter URL base da API
    let socketUrl = getApiBaseUrl().replace('/api', '');
    
    // Em produção, garantir que não estamos usando localhost
    if (isProduction && (socketUrl.includes('localhost') || socketUrl.includes('127.0.0.1'))) {
      console.warn('[SocketService] Detectada URL localhost em produção, usando origem atual');
      socketUrl = window.location.origin;
    }
    
    console.log(`[SocketService] URL do socket: ${socketUrl}`);
    return socketUrl;
  }

  /**
   * Solicita dados recentes com um mecanismo de timeout e retry
   */
  requestRecentNumbers(): void {
    if (!this.socket || this.simulationMode) {
      console.log('[Socket] Não é possível solicitar dados recentes (simulação ou sem socket)');
      return;
    }
    
    console.log('[Socket] Solicitando dados recentes...');
    
    // Implementar um mecanismo de timeout para evitar problemas
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout ao solicitar dados recentes'));
      }, 4000); // 4s timeout
    });
    
    // Função para emitir o evento com Promise
    const emitWithPromise = () => {
      return new Promise<void>((resolve, reject) => {
        try {
          // Criar um callback que resolve a promise
          const callback = (data: any) => {
            console.log('[Socket] Dados recentes recebidos');
            resolve();
          };
          
          // Emitir com callback (timeout implícito do Socket.IO)
          this.socket?.emit('get_recent_data', {}, callback);
          
          // Adicionar um listener de fallback para dados iniciais
          this.socket?.once('initial_data', (data) => {
            console.log('[Socket] Dados iniciais recebidos');
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    };
    
    // Executar com proteção de timeout
    Promise.race([emitWithPromise(), timeoutPromise])
      .catch(error => {
        console.error(`[Socket] Erro ao solicitar dados recentes: ${error.message}`);
        
        // Tentar uma solução alternativa em caso de falha - recurso assíncrono com dados da API
        this.loadHistoricalRouletteNumbers();
      });
  }
  
  // Método para carregar dados históricos via REST API
  async loadHistoricalRouletteNumbers(): Promise<void> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      console.log(`[SocketService] Carregando dados históricos das roletas`);
      
      // Buscar todas as roletas de uma vez usando o endpoint único
      const rouletteResponse = await fetch(`${apiBaseUrl}/ROULETTES`);
      
      if (!rouletteResponse.ok) {
        throw new Error(`Falha ao buscar lista de roletas: ${rouletteResponse.status}`);
      }
      
      const roulettes = await rouletteResponse.json();
      
      if (Array.isArray(roulettes)) {
        console.log(`[SocketService] Processando dados históricos para ${roulettes.length} roletas`);
        
        // Para cada roleta, processar seus números (que já estão incluídos na resposta)
        for (const roulette of roulettes) {
          try {
            console.log(`[SocketService] Processando números para roleta ${roulette.nome || roulette.name}`);
            
            // Verificar se a roleta já tem números incluídos na resposta
            if (roulette.numero && Array.isArray(roulette.numero)) {
              console.log(`[SocketService] Encontrados ${roulette.numero.length} números para roleta ${roulette.nome || roulette.name}`);
              
              // Converter cada número para o formato de evento
              roulette.numero.forEach(num => {
                // Verificar se o número é válido
                if (num && (typeof num === 'number' || typeof num.numero === 'number')) {
                  const numero = typeof num === 'number' ? num : num.numero;
                  
                  const event = {
                    type: 'new_number',
                    roleta_id: roulette._id || roulette.id,
                    roleta_nome: roulette.nome || roulette.name,
                    numero: numero,
                    timestamp: (num && num.timestamp) ? num.timestamp : new Date().toISOString()
                  };
                  
                  // Notificar os listeners sobre este número
                  this.notifyListeners('new_number', event);
                }
              });
            } else {
              console.warn(`[SocketService] Roleta ${roulette.nome || roulette.name} não possui números`);
            }
          } catch (error) {
            console.error(`[SocketService] Erro ao processar números para roleta ${roulette._id || roulette.id}:`, error);
          }
        }
        
        console.log('[SocketService] Carregamento de todos os dados históricos concluído');
      } else {
        console.warn('[SocketService] Resposta inválida ao buscar roletas:', roulettes);
        // Tentar endpoints alternativos
        this.tryAlternativeHistoricalEndpoints();
      }
    } catch (error) {
      console.error('[SocketService] Erro ao carregar dados históricos:', error);
      // Tentar endpoints alternativos se o principal falhar
      this.tryAlternativeHistoricalEndpoints();
    }
  }
  
  // Método para tentar endpoints alternativos
  private async tryAlternativeHistoricalEndpoints(): Promise<void> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      console.log(`[SocketService] Tentando endpoints alternativos para dados históricos`);
      
      // Tentar o endpoint principal novo
      const response = await fetch(`${apiBaseUrl}/ROULETTES`);
      
      if (!response.ok) {
        throw new Error(`Falha ao buscar dados históricos alternativos: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        data.forEach(roulette => {
          if (roulette && roulette.nome && Array.isArray(roulette.numero)) {
            roulette.numero.forEach(numero => {
              const event = {
                type: 'new_number',
                roleta_id: roulette._id || roulette.id || 'unknown',
                roleta_nome: roulette.nome,
                numero: typeof numero === 'object' ? numero.numero : numero,
                timestamp: (numero && numero.timestamp) ? numero.timestamp : new Date().toISOString()
              };
              
              this.notifyListeners('new_number', event);
            });
          }
        });
      } else {
        console.warn('[SocketService] Resposta alternativa inválida:', data);
        
        // Se estamos em desenvolvimento, usar dados simulados como último recurso
        if (!isProduction) {
          this.loadMockData();
        }
      }
    } catch (error) {
      console.error('[SocketService] Erro ao tentar endpoints alternativos:', error);
      
      // Em último caso, usar dados simulados em desenvolvimento
      if (!isProduction) {
        this.loadMockData();
      }
    }
  }
  
  // Método para carregar dados simulados em desenvolvimento
  private loadMockData(): void {
    console.log('[SocketService] Carregando dados simulados para desenvolvimento');
    
    const mockRoulettes = [
      { id: 'roulette-1', name: 'Brazilian Mega Roulette', numbers: [1, 7, 13, 36, 24, 17, 32, 11] },
      { id: 'roulette-2', name: 'Speed Auto Roulette', numbers: [0, 32, 15, 19, 4, 21, 36, 7] },
      { id: 'roulette-3', name: 'Bucharest Auto-Roulette', numbers: [26, 3, 35, 12, 28, 5, 14, 19] }
    ];
    
    // Processar os dados mock
    mockRoulettes.forEach(roulette => {
      console.log(`[SocketService] Processando dados mock para ${roulette.name}`);
      
      roulette.numbers.forEach(number => {
        const event: RouletteNumberEvent = {
          type: 'new_number',
          roleta_id: roulette.id,
          roleta_nome: roulette.name,
          numero: number,
          timestamp: new Date().toISOString()
        };
        
        this.notifyListeners('new_number', event);
      });
    });
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event) || [];
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[SocketService] Erro ao notificar listener de ${event}:`, error);
        }
      });
    }
  }

  /**
   * Força a reconexão de todos os sockets
   * Útil quando ocorrem erros de canal fechado
   */
  public reconnectAllSockets(): void {
    console.log('[Socket] Forçando reconexão de todos os sockets');
    
    // Desconectar o socket atual se estiver ativo
    if (this.socket) {
      try {
        console.log('[Socket] Desconectando socket atual');
        this.socket.disconnect();
      } catch (error) {
        console.error('[Socket] Erro ao desconectar socket:', error);
      }
      
      // Limpar referência
      this.socket = null;
    }
    
    // Resetar estado
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.simulationMode = false;
    
    // Tentar reconectar após um pequeno delay
    setTimeout(() => {
      console.log('[Socket] Tentando reconectar após reset');
      this.connect();
      
      // Carregar dados históricos novamente
      this.loadHistoricalRouletteNumbers().catch(err => {
        console.error('[Socket] Erro ao recarregar dados históricos:', err);
      });
    }, 1000);
  }
}

export default SocketService; 