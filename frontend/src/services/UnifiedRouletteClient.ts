/**
 * Cliente unificado para dados das roletas
 * Centraliza acesso aos dados de roletas exclusivamente via Stream SSE
 */

import EventService from './EventService';
import { RouletteNumberEvent } from './EventService';
import { getLogger } from './utils/logger';
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';
import config from '@/config/env';

const logger = getLogger('UnifiedRouletteClient');

// Definição dos tipos
interface RouletteData {
  id: string;
  _id?: string;
  canonical_id?: string;
  nome: string;
  name?: string;
  numero?: number | number[] | any[];
  numeros?: number[];
  ultima_atualizacao?: string;
  provider?: string;
  status?: string;
}

interface ClientOptions {
  streamingEnabled?: boolean;
  autoConnect?: boolean;
}

interface ClientStatus {
  isConnected: boolean; // Indica se o mapa de roletas tem dados
  isStreamConnected: boolean; // Indica se a conexão SSE está ativa
  lastUpdate: string;
  source: 'stream' | 'disconnected';
}

class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient;
  private roulettes: Map<string, RouletteData> = new Map();
  private eventSource: EventSource | null = null;
  private isStreamingEnabled: boolean = true;
  private isStreamConnected: boolean = false;
  private isConnecting: boolean = false; // Flag para controlar tentativas de conexão
  private lastUpdate: string = '';
  private streamUrl: string = '';
  private eventService: EventService;
  private reconnectTimeoutId: NodeJS.Timeout | null = null; 

  private constructor(options?: ClientOptions) {
    this.eventService = EventService.getInstance();
    
    if (options) {
      this.isStreamingEnabled = options.streamingEnabled !== false;
      if (options.autoConnect === true && this.isStreamingEnabled) {
        this.connectStream();
      }
    }
    
    logger.info('UnifiedRouletteClient inicializado para operar via SSE');
  }

  public static getInstance(options?: ClientOptions): UnifiedRouletteClient {
    if (!UnifiedRouletteClient.instance) {
      UnifiedRouletteClient.instance = new UnifiedRouletteClient(options);
    } else if (options) {
      if (options.streamingEnabled !== undefined) {
        UnifiedRouletteClient.instance.isStreamingEnabled = options.streamingEnabled;
      }
      if (options.autoConnect === true && UnifiedRouletteClient.instance.isStreamingEnabled) {
        // Apenas chama connectStream se não estiver já conectado ou conectando
        if(!UnifiedRouletteClient.instance.isStreamConnected && !UnifiedRouletteClient.instance.isConnecting) {
            UnifiedRouletteClient.instance.connectStream();
        }
      }
    }
    return UnifiedRouletteClient.instance;
  }

  public connectStream(): boolean {
    if (!this.isStreamingEnabled) {
      logger.info('Streaming está desativado, não conectando ao stream');
      return false;
    }
    
    // Se já está conectado ou uma tentativa de conexão está em andamento, não faz nada
    if ((this.eventSource && this.isStreamConnected) || this.isConnecting) {
      logger.info(`Stream já conectado ou tentativa em andamento. Conectado: ${this.isStreamConnected}, Conectando: ${this.isConnecting}`);
      return true;
    }
    
    // Limpa timeout de reconexão anterior, se houver
    if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
    }

    // Garante que qualquer instância anterior seja fechada
    if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
    }

    this.isConnecting = true; // Marca que uma tentativa de conexão foi iniciada
    this.isStreamConnected = false;
    
    try {
      this.streamUrl = `${config.apiBaseUrl}/stream/roulettes`;
      logger.info(`Conectando ao stream em: ${this.streamUrl}`);
      
      this.eventSource = new EventSource(this.streamUrl);
      
      this.eventSource.onopen = () => {
        logger.info('Stream SSE conectado com sucesso');
        this.isStreamConnected = true;
        this.isConnecting = false; // Conexão estabelecida
        this.lastUpdate = new Date().toISOString();
        EventService.emitGlobalEvent('roulette_stream_connected', {
          timestamp: this.lastUpdate,
          url: this.streamUrl
        });
      };
      
      this.eventSource.onerror = (error) => {
        logger.error('Erro na conexão SSE:', error);
        this.isStreamConnected = false;
        this.isConnecting = false; // Tentativa de conexão falhou ou foi interrompida
        
        if (this.eventSource) {
            this.eventSource.close(); // Fecha a conexão atual problemática
            this.eventSource = null;
        }
        
        // Tentar reconectar automaticamente após um tempo, apenas se o streaming estiver habilitado
        if (this.isStreamingEnabled && !this.reconnectTimeoutId) {
            logger.info('Agendando tentativa de reconexão SSE em 5 segundos...');
            this.reconnectTimeoutId = setTimeout(() => {
                this.reconnectTimeoutId = null; // Limpa o ID do timeout antes de tentar reconectar
                this.connectStream();
            }, 5000);
        }
        EventService.emitGlobalEvent('roulette_stream_error', {
          timestamp: new Date().toISOString(),
          error: 'Erro na conexão SSE'
        });
      };
      
      this.eventSource.addEventListener('number', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          this.handleNumberEvent(data);
        } catch (error) {
          logger.error('Erro ao processar evento de número:', error);
        }
      });
      
      this.eventSource.addEventListener('update', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          this.handleUpdateEvent(data);
        } catch (error) {
          logger.error('Erro ao processar evento de atualização:', error);
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Erro crítico ao iniciar conexão com o stream (ex: URL inválida):', error);
      this.isStreamConnected = false;
      this.isConnecting = false; // Falha crítica ao tentar conectar
      return false;
    }
  }

  public disconnectStream(): void {
    logger.info('Desconectando do stream SSE solicitado...');
    if (this.reconnectTimeoutId) { // Cancela qualquer tentativa de reconexão agendada
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isStreamConnected = false;
    this.isConnecting = false; // Garante que o estado de conexão seja resetado
  }

  private handleNumberEvent(data: any): void {
    if (!data || !data.roleta_id || data.numero === undefined) {
      logger.warn('Evento de número inválido recebido via SSE:', data);
      return;
    }
    
    const roletaId = data.roleta_id;
    const roletaNome = data.roleta_nome || 'Roleta sem nome';
    const numero = typeof data.numero === 'number' ? data.numero : 
                  typeof data.numero === 'string' ? parseInt(data.numero, 10) : 0;
    
    logger.debug(`SSE Número: ${roletaNome} - ${numero}`);
    
    const roleta = this.roulettes.get(roletaId) || {
      id: roletaId,
      nome: roletaNome,
      numeros: []
    };
    
    const numeros = Array.isArray(roleta.numeros) ? roleta.numeros : [];
    numeros.unshift(numero);
    if (numeros.length > 100) numeros.length = 100;
    
    this.roulettes.set(roletaId, {
      ...roleta,
      numeros,
      ultima_atualizacao: new Date().toISOString()
    });
    
    const event: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      numero: numero,
      timestamp: new Date().toISOString()
    };
    this.eventService.dispatchEvent(event);
    this.lastUpdate = new Date().toISOString();
  }

  private handleUpdateEvent(data: any): void {
    if (!data || !data.roletas || !Array.isArray(data.roletas)) {
      logger.warn('Evento de atualização inválido recebido via SSE:', data);
      return;
    }
    
    logger.info(`SSE Atualização: ${data.roletas.length} roletas`);
    
    data.roletas.forEach((roletaData: any) => {
      if (!roletaData || !roletaData.id) return;
      if (!ROLETAS_PERMITIDAS.includes(roletaData.id) && ROLETAS_PERMITIDAS.length > 0) return;
      
      const existingRoleta = this.roulettes.get(roletaData.id) || {
        id: roletaData.id,
        nome: roletaData.nome || 'Roleta sem nome',
        numeros: []
      };
      
      let numerosToUpdate = existingRoleta.numeros;
      if (roletaData.numeros && Array.isArray(roletaData.numeros)) {
        numerosToUpdate = roletaData.numeros;
      } else if (roletaData.numero && Array.isArray(roletaData.numero)) {
        numerosToUpdate = roletaData.numero.map((item: any) => 
          (typeof item === 'object' && item.numero !== undefined) ? Number(item.numero) : Number(item)
        );
      }

      this.roulettes.set(roletaData.id, {
        ...existingRoleta,
        ...roletaData,
        numeros: numerosToUpdate,
        ultima_atualizacao: new Date().toISOString()
      });
    });
    
    this.lastUpdate = new Date().toISOString();
    EventService.emitGlobalEvent('roulettes_updated', {
      count: data.roletas.length,
      timestamp: this.lastUpdate,
      source: 'stream'
    });
  }

  public getAllRoulettes(): RouletteData[] {
    return Array.from(this.roulettes.values());
  }

  public getRouletteById(roletaId: string): RouletteData | undefined {
    return this.roulettes.get(roletaId);
  }

  public async forceUpdate(): Promise<void> {
    logger.warn('UnifiedRouletteClient opera exclusivamente via SSE. Tentando reconectar para forçar atualização de dados do servidor.');
    if (this.isStreamConnected) {
        // Se já conectado, uma forma de "forçar" seria desconectar e reconectar, ou emitir um evento.
        // Por ora, vamos desconectar e reconectar para tentar obter o conjunto mais recente de dados.
        this.disconnectStream();
        this.connectStream(); 
    } else {
        logger.info('Stream SSE não conectado. Tentando conectar para obter dados atualizados.');
        this.connectStream(); 
    }
    return Promise.resolve();
  }

  public getStatus(): ClientStatus {
    return {
      isConnected: this.roulettes.size > 0, 
      isStreamConnected: this.isStreamConnected,
      lastUpdate: this.lastUpdate,
      source: this.isStreamConnected ? 'stream' : 'disconnected'
    };
  }
  
  public requestRecentNumbers(): void {
    if (this.isStreamConnected && this.eventSource) {
      logger.debug('Cliente conectado ao stream SSE. O servidor deve enviar os dados recentes ativamente.');
    } else {
      logger.warn('Não é possível solicitar números recentes: Stream SSE não conectado.');
       if(!this.isStreamConnected && !this.isConnecting) { // Evita múltiplas tentativas se já estiver conectando
        logger.info('Tentando reconectar ao stream para obter dados.');
        this.connectStream(); 
       }
    }
  }
  
  public dispose(): void {
    logger.info('Liberando recursos do UnifiedRouletteClient');
    this.disconnectStream();
    this.roulettes.clear();
    EventService.emitGlobalEvent('roulette_client_disposed', {
      timestamp: new Date().toISOString()
    });
  }
}

export default UnifiedRouletteClient; 