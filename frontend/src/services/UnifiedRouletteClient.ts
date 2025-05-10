/**
 * Cliente unificado para dados das roletas
 * Busca dados históricos via REST e atualizações via Stream SSE
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
  fetchInitialData?: boolean; // Nova opção para controlar busca inicial
}

interface ClientStatus {
  isConnected: boolean; 
  isStreamConnected: boolean; 
  isFetchingInitialData: boolean;
  lastUpdate: string;
  source: 'stream' | 'disconnected' | 'api';
}

class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient;
  private roulettes: Map<string, RouletteData> = new Map();
  private eventSource: EventSource | null = null;
  private isStreamingEnabled: boolean = true;
  private isStreamConnected: boolean = false;
  private isConnecting: boolean = false; 
  private isFetchingInitial: boolean = false; // Flag para controle da busca inicial
  private lastUpdate: string = '';
  private streamUrl: string = '';
  private historicalDataUrl: string = '';
  private eventService: EventService;
  private reconnectTimeoutId: NodeJS.Timeout | null = null; 

  private constructor(options?: ClientOptions) {
    this.eventService = EventService.getInstance();
    this.historicalDataUrl = `${config.apiBaseUrl}/historical/all-roulettes`;
    
    if (options) {
      this.isStreamingEnabled = options.streamingEnabled !== false;
      if (options.fetchInitialData !== false) { // Busca dados iniciais por padrão
        this.fetchInitialRouletteData().then(() => {
          // Após buscar dados iniciais, tenta conectar ao stream se habilitado
          if (options.autoConnect === true && this.isStreamingEnabled) {
            this.connectStream();
          }
        });
      } else if (options.autoConnect === true && this.isStreamingEnabled) {
        // Se não for buscar dados iniciais, mas autoConnect estiver ativo para stream
        this.connectStream();
      }
    }
    
    logger.info('UnifiedRouletteClient inicializado');
  }

  public static getInstance(options?: ClientOptions): UnifiedRouletteClient {
    if (!UnifiedRouletteClient.instance) {
      UnifiedRouletteClient.instance = new UnifiedRouletteClient(options);
    } else if (options) {
      // Atualiza opções da instância existente, se necessário
      if (options.streamingEnabled !== undefined) {
        UnifiedRouletteClient.instance.isStreamingEnabled = options.streamingEnabled;
      }
      // Lógica de (re)conexão ou busca inicial baseada nas novas opções
      if (options.fetchInitialData) {
        UnifiedRouletteClient.instance.fetchInitialRouletteData();
      }
      if (options.autoConnect && UnifiedRouletteClient.instance.isStreamingEnabled && 
          !UnifiedRouletteClient.instance.isStreamConnected && !UnifiedRouletteClient.instance.isConnecting) {
        UnifiedRouletteClient.instance.connectStream();
      }
    }
    return UnifiedRouletteClient.instance;
  }

  /**
   * Busca os dados históricos iniciais das roletas via REST API.
   */
  public async fetchInitialRouletteData(): Promise<void> {
    if (this.isFetchingInitial) {
      logger.info('Busca de dados iniciais já em andamento.');
      return;
    }
    this.isFetchingInitial = true;
    logger.info(`Buscando dados históricos iniciais de: ${this.historicalDataUrl}`);

    try {
      const response = await fetch(this.historicalDataUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true' // Se necessário para seu ambiente de túnel
        }
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP ao buscar dados históricos: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida dos dados históricos: não é um array.');
      }

      logger.info(`Recebidos dados históricos de ${data.length} roletas.`);
      const now = new Date().toISOString();
      data.forEach((roletaData: any) => {
        if (!roletaData || !roletaData.id) return;
        if (!ROLETAS_PERMITIDAS.includes(roletaData.id) && ROLETAS_PERMITIDAS.length > 0) return;

        this.roulettes.set(roletaData.id, {
          ...roletaData,
          ultima_atualizacao: roletaData.ultima_atualizacao || now,
          numeros: roletaData.numeros || []
        });
      });

      this.lastUpdate = now;
      EventService.emitGlobalEvent('roulettes_historical_data_loaded', {
        count: this.roulettes.size,
        timestamp: this.lastUpdate,
        source: 'api'
      });
    } catch (error) {
      logger.error('Falha ao buscar dados históricos iniciais:', error);
      EventService.emitGlobalEvent('roulettes_historical_data_error', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    } finally {
      this.isFetchingInitial = false;
    }
  }

  public connectStream(): boolean {
    if (!this.isStreamingEnabled) {
      logger.info('Streaming está desativado, não conectando ao stream');
      return false;
    }
    if ((this.eventSource && this.isStreamConnected) || this.isConnecting) {
      logger.info(`Stream já conectado ou tentativa em andamento. Conectado: ${this.isStreamConnected}, Conectando: ${this.isConnecting}`);
      return true;
    }
    if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
    }
    if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
    }
    this.isConnecting = true; 
    this.isStreamConnected = false;
    try {
      this.streamUrl = `${config.apiBaseUrl}/stream/roulettes`;
      logger.info(`Conectando ao stream em: ${this.streamUrl}`);
      this.eventSource = new EventSource(this.streamUrl);
      this.eventSource.onopen = () => {
        logger.info('Stream SSE conectado com sucesso');
        this.isStreamConnected = true;
        this.isConnecting = false; 
        this.lastUpdate = new Date().toISOString();
        EventService.emitGlobalEvent('roulette_stream_connected', {
          timestamp: this.lastUpdate,
          url: this.streamUrl
        });
      };
      this.eventSource.onerror = (error) => {
        logger.error('Erro na conexão SSE:', error);
        this.isStreamConnected = false;
        this.isConnecting = false; 
        if (this.eventSource) {
            this.eventSource.close(); 
            this.eventSource = null;
        }
        if (this.isStreamingEnabled && !this.reconnectTimeoutId) {
            logger.info('Agendando tentativa de reconexão SSE em 5 segundos...');
            this.reconnectTimeoutId = setTimeout(() => {
                this.reconnectTimeoutId = null; 
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
      this.isConnecting = false; 
      return false;
    }
  }

  public disconnectStream(): void {
    logger.info('Desconectando do stream SSE solicitado...');
    if (this.reconnectTimeoutId) { 
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isStreamConnected = false;
    this.isConnecting = false; 
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
    logger.info('Forçando atualização de dados: buscando históricos e reconectando ao stream SSE.');
    await this.fetchInitialRouletteData(); // Busca dados históricos novamente
    if (this.isStreamingEnabled) {
        // Desconecta e reconecta o stream para garantir que pegue as últimas atualizações se o servidor as enviar no connect
        this.disconnectStream();
        this.connectStream(); 
    }
  }

  public getStatus(): ClientStatus {
    return {
      isConnected: this.roulettes.size > 0, 
      isStreamConnected: this.isStreamConnected,
      isFetchingInitialData: this.isFetchingInitial,
      lastUpdate: this.lastUpdate,
      source: this.isStreamConnected ? 'stream' : (this.isFetchingInitial ? 'api' : 'disconnected')
    };
  }
  
  public requestRecentNumbers(): void {
    // Com a carga inicial via REST, este método pode ser menos crítico
    // ou pode ser usado para sinalizar ao servidor via SSE (se suportado)
    if (this.isStreamConnected && this.eventSource) {
      logger.debug('Cliente conectado ao stream SSE. Para dados recentes, confiar no stream ou em uma nova carga inicial via forceUpdate.');
    } else {
      logger.warn('Stream SSE não conectado. Tentando reconectar para obter dados.');
       if(!this.isStreamConnected && !this.isConnecting) { 
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