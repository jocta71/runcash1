/**
 * Cliente unificado para dados das roletas
 * Busca dados históricos via REST (/api/historical/all-roulettes) e atualizações via Stream SSE (/api/stream/roulettes)
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
  fetchInitialData?: boolean; // Opção para controlar busca inicial
}

interface ClientStatus {
  isConnected: boolean; 
  isStreamConnected: boolean; 
  isFetchingInitialData: boolean;
  lastUpdate: string;
  source: 'stream' | 'disconnected' | 'api';
  rouletteCount: number; // Adicionando contagem de roletas
}

// Tipo para os eventos do EventSource SSE
type SSEEvent = {
  roleta_id?: string;
  roleta_nome?: string;
  numero?: number;
  timestamp?: string;
  type?: string;
  data?: any[];
  _timestamp?: number;
  [key: string]: any;
};

// Resposta da API que pode conter dados criptografados
interface ApiResponse {
  success?: boolean;
  encrypted?: boolean;
  format?: string;
  encryptedData?: any;
  data?: any; 
  roulettes?: any[];
  limited?: boolean;
  [key: string]: any;
}

class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient;
  private roulettes: Map<string, RouletteData> = new Map();
  private eventSource: EventSource | null = null;
  private isStreamingEnabled: boolean = true;
  private isStreamConnected: boolean = false;
  private isConnecting: boolean = false; 
  private isFetchingInitial: boolean = false;
  private initialDataLoaded: boolean = false; // Flag para indicar que os dados iniciais foram carregados
  private lastUpdate: string = '';
  private streamUrl: string = '';
  private historicalDataUrl: string = '';
  private eventService: EventService;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  private constructor(options?: ClientOptions) {
    this.eventService = EventService.getInstance();
    this.streamUrl = `${config.apiBaseUrl}/stream/roulettes`;
    this.historicalDataUrl = `${config.apiBaseUrl}/historical/all-roulettes`;
    
    // Inicializar coleções de listeners
    ['update', 'initialHistoryLoaded', 'initialHistoryError', 'streamConnected', 'streamError'].forEach(event => {
      this.eventListeners.set(event, new Set());
    });
    
    if (options) {
      this.isStreamingEnabled = options.streamingEnabled !== false;
      
      // Sequência de inicialização:
      // 1. Buscar dados históricos (REST) se configurado
      // 2. Conectar ao stream SSE após buscar os dados históricos ou diretamente se não buscar histórico
      if (options.fetchInitialData !== false) {
        this.fetchInitialRouletteData().then(() => {
          if (options.autoConnect === true && this.isStreamingEnabled) {
            this.connectStream();
          }
        }).catch(error => {
          logger.error('Falha na busca inicial de dados históricos:', error);
          // Mesmo com erro, tentar conectar ao stream se configurado
          if (options.autoConnect === true && this.isStreamingEnabled) {
            this.connectStream();
          }
        });
      } else if (options.autoConnect === true && this.isStreamingEnabled) {
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
   * Registra callbacks para eventos específicos
   */
  public on(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
    
    // Retorna função para cancelar o registro
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emite um evento para todos os listeners registrados
   */
  private emit(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event) || new Set();
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Erro ao processar listener para evento '${event}':`, error);
        }
      });
    }
  }

  /**
   * Alias para fetchInitialRouletteData para compatibilidade com código legado
   */
  public fetchRouletteData(): Promise<void> {
    logger.debug('Chamada de método legado fetchRouletteData() redirecionada para fetchInitialRouletteData()');
    return this.fetchInitialRouletteData();
  }

  /**
   * Busca os dados históricos iniciais das roletas via REST API (/api/historical/all-roulettes).
   * Este método é chamado apenas uma vez no início da aplicação.
   */
  public async fetchInitialRouletteData(): Promise<void> {
    if (this.isFetchingInitial) {
      logger.info('Busca de dados iniciais já em andamento.');
      return;
    }
    
    this.isFetchingInitial = true;
    logger.info(`Buscando dados históricos iniciais de: ${this.historicalDataUrl}`);

    try {
      const authToken = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'bypass-tunnel-reminder': 'true'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(this.historicalDataUrl, { headers });

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status} ao buscar dados históricos: ${response.statusText}`);
      }

      const responseData: ApiResponse = await response.json();
      let roulettesArray: any[] = [];

      if (responseData.encrypted && responseData.format === 'iron') {
        logger.info('Recebidos dados históricos criptografados. O frontend não pode descriptografar. Verificando campos de fallback.');
        if (responseData.data && Array.isArray(responseData.data)) {
          roulettesArray = responseData.data;
        } else if (responseData.roulettes && Array.isArray(responseData.roulettes)) {
          roulettesArray = responseData.roulettes;
        }
        if (roulettesArray.length === 0) {
            logger.warn('Dados criptografados sem fallback de array de roletas utilizável.');
        }
      } else if (Array.isArray(responseData)) {
        roulettesArray = responseData;
      } else if (typeof responseData === 'object' && responseData !== null) {
        if (responseData.data && Array.isArray(responseData.data)) {
          roulettesArray = responseData.data;
        } else if (responseData.roulettes && Array.isArray(responseData.roulettes)) {
          roulettesArray = responseData.roulettes;
        } else {
          // Tentar encontrar um array em alguma propriedade do objeto
          let found = false;
          for (const key in responseData) {
            if (Object.prototype.hasOwnProperty.call(responseData, key) && Array.isArray(responseData[key])) {
              // Verificar se os itens do array parecem ser roletas (ex: têm id e nome)
              const potentialArray = responseData[key] as any[];
              if (potentialArray.length > 0 && potentialArray[0].id && (potentialArray[0].nome || potentialArray[0].name)) {
                logger.info(`Encontrado array de roletas na propriedade '${key}' do objeto de resposta.`);
                roulettesArray = potentialArray;
                found = true;
                break;
              }
            }
          }
          if (!found) {
            logger.warn('Resposta dos dados históricos é um objeto, mas não foi encontrado um array de roletas nos campos esperados (data, roulettes) ou em outras propriedades. Estrutura recebida:', JSON.stringify(Object.keys(responseData)));
            // Considerar como lista vazia em vez de erro fatal, a menos que a API deva sempre retornar uma lista.
            // throw new Error('Resposta inválida dos dados históricos: formato de objeto não reconhecido ou array de roletas não encontrado.');
          }
        }
      } else {
        logger.error('Formato de resposta completamente inesperado para dados históricos. Resposta recebida:', responseData);
        throw new Error('Resposta inválida dos dados históricos: formato completamente inesperado.');
      }

      if (roulettesArray.length > 0) {
        logger.info(`Dados históricos extraídos com sucesso: ${roulettesArray.length} roletas.`);
      } else {
        logger.warn('Nenhum dado de roleta foi extraído da resposta histórica. A lista de roletas estará vazia.');
      }
      
      const processedNumbers: Map<string, any[]> = new Map();
      const now = new Date().toISOString();
      
      roulettesArray.forEach((roletaData: any) => {
        if (!roletaData || !roletaData.id) {
          logger.warn('Dados de roleta inválidos recebidos:', roletaData);
          return;
        }
        
        const roletaId = roletaData.id.toString();
        
        // Se há filtragem de roletas permitidas e esta não está na lista, pular
        if (ROLETAS_PERMITIDAS.length > 0 && !ROLETAS_PERMITIDAS.includes(roletaId)) {
          return;
        }
        
        // Normalizar campo de números
        const numeros = this.normalizeNumbersArray(roletaData.numeros || roletaData.numero || []);
        
        // Salvar no mapa
        this.roulettes.set(roletaId, {
          ...roletaData,
          numeros,
          ultima_atualizacao: roletaData.ultima_atualizacao || now,
          nome: roletaData.nome || roletaData.name || `Roleta ${roletaId}`
        });
        
        // Salvar números processados para emitir eventos
        processedNumbers.set(roletaData.nome || roletaData.name || roletaId, numeros);
      });

      this.lastUpdate = now;
      this.initialDataLoaded = true;
      
      // Emitir evento global
      EventService.emitGlobalEvent('roulettes_historical_data_loaded', {
        count: this.roulettes.size,
        timestamp: this.lastUpdate,
        source: 'api'
      });
      
      // Emitir evento para os componentes inscritos
      this.emit('initialHistoryLoaded', processedNumbers);
      
      logger.info(`Dados históricos carregados com sucesso: ${this.roulettes.size} roletas`);
      
    } catch (error) {
      logger.error('Falha ao buscar dados históricos iniciais:', error);
      
      // Emitir eventos de erro
      EventService.emitGlobalEvent('roulettes_historical_data_error', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      
      this.emit('initialHistoryError', error);
      
    } finally {
      this.isFetchingInitial = false;
    }
  }

  /**
   * Normaliza arrays de números que podem vir em diferentes formatos
   */
  private normalizeNumbersArray(input: any): any[] {
    if (!input) return [];
    
    // Se já é um array
    if (Array.isArray(input)) {
      return input.map(item => 
        (typeof item === 'object' && item.numero !== undefined) ? Number(item.numero) : Number(item)
      ).filter(num => !isNaN(num));
    }
    
    // Se é um número
    if (typeof input === 'number') {
      return [input];
    }
    
    // Se é um objeto com propriedade número
    if (typeof input === 'object' && input.numero !== undefined) {
      return [Number(input.numero)];
    }
    
    return [];
  }

  /**
   * Conecta ao stream SSE para receber atualizações em tempo real
   */
  public connectStream(): boolean {
    if (!this.isStreamingEnabled) {
      logger.info('Streaming está desativado, não conectando ao stream');
      return false;
    }
    
    if ((this.eventSource && this.isStreamConnected) || this.isConnecting) {
      logger.info(`Stream já conectado ou tentativa em andamento. Conectado: ${this.isStreamConnected}, Conectando: ${this.isConnecting}`);
      return true;
    }
    
    // Limpar qualquer reconexão agendada
    if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
    }
    
    // Fechar conexão existente, se houver
    if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
    }
    
    this.isConnecting = true; 
    this.isStreamConnected = false;
    
    try {
      logger.info(`Conectando ao stream SSE em: ${this.streamUrl}`);
      
      // Criar nova conexão SSE
      this.eventSource = new EventSource(this.streamUrl);
      
      // Configurar handlers
      this.eventSource.onopen = () => {
        logger.info('Stream SSE conectado com sucesso');
        this.isStreamConnected = true;
        this.isConnecting = false; 
        this.lastUpdate = new Date().toISOString();
        
        // Emitir eventos
        EventService.emitGlobalEvent('roulette_stream_connected', {
          timestamp: this.lastUpdate,
          url: this.streamUrl
        });
        
        this.emit('streamConnected', {
          timestamp: this.lastUpdate,
          url: this.streamUrl
        });
      };
      
      // Handler de erro
      this.eventSource.onerror = (error) => {
        logger.error('Erro na conexão SSE:', error);
        this.isStreamConnected = false;
        this.isConnecting = false; 
        
        // Fechar conexão com erro
        if (this.eventSource) {
            this.eventSource.close(); 
            this.eventSource = null;
        }
        
        // Agendar reconexão se estiver habilitado
        if (this.isStreamingEnabled && !this.reconnectTimeoutId) {
            logger.info('Agendando tentativa de reconexão SSE em 5 segundos...');
            this.reconnectTimeoutId = setTimeout(() => {
                this.reconnectTimeoutId = null; 
                this.connectStream();
            }, 5000);
        }
        
        // Emitir eventos de erro
        EventService.emitGlobalEvent('roulette_stream_error', {
          timestamp: new Date().toISOString(),
          error: 'Erro na conexão SSE'
        });
        
        this.emit('streamError', {
          timestamp: new Date().toISOString(),
          error
        });
      };
      
      // Escutar evento de números
      this.eventSource.addEventListener('number', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          this.handleNumberEvent(data);
        } catch (error) {
          logger.error('Erro ao processar evento de número:', error);
        }
      });
      
      // Escutar evento de atualizações
      this.eventSource.addEventListener('update', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          this.handleUpdateEvent(data);
        } catch (error) {
          logger.error('Erro ao processar evento de atualização:', error);
        }
      });
      
      // Escutar evento de atualização em massa de todas as roletas
      this.eventSource.addEventListener('all_roulettes_update', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          this.handleAllRoulettesUpdate(data);
        } catch (error) {
          logger.error('Erro ao processar evento de atualização em massa:', error);
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Erro crítico ao iniciar conexão com o stream SSE:', error);
      this.isStreamConnected = false;
      this.isConnecting = false;
      
      // Emitir evento de erro
      this.emit('streamError', {
        timestamp: new Date().toISOString(),
        error
      });
      
      return false;
    }
  }

  /**
   * Desconecta do stream SSE
   */
  public disconnectStream(): void {
    logger.info('Desconectando do stream SSE...');
    
    // Limpar reconexão agendada
    if (this.reconnectTimeoutId) { 
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
    }
    
    // Fechar conexão
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.isStreamConnected = false;
    this.isConnecting = false;
    
    // Emitir evento
    EventService.emitGlobalEvent('roulette_stream_disconnected', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Manipula eventos de novos números recebidos pelo stream SSE
   */
  private handleNumberEvent(data: SSEEvent): void {
    if (!data || !data.roleta_id || data.numero === undefined) {
      logger.warn('Evento SSE de número inválido:', data);
      return;
    }
    
    const roletaId = data.roleta_id.toString();
    
    // Verificar se a roleta está na lista de permitidas (se houver filtragem)
    if (ROLETAS_PERMITIDAS.length > 0 && !ROLETAS_PERMITIDAS.includes(roletaId)) {
      return;
    }
    
    // Obter roleta existente ou criar nova
    const roulette = this.roulettes.get(roletaId) || {
      id: roletaId,
      nome: data.roleta_nome || `Roleta ${roletaId}`,
      numeros: []
    };
    
    // Converter para número
    const numero = Number(data.numero);
    if (isNaN(numero)) {
      logger.warn(`Número inválido recebido para roleta ${roletaId}:`, data.numero);
      return;
    }
    
    // Adicionar número (se já não existir um array, criar)
    if (!Array.isArray(roulette.numeros)) {
      roulette.numeros = [];
    }
    
    // Adicionar no início para ter os mais recentes primeiro
    roulette.numeros.unshift(numero);
    
    // Atualizar timestamp
    roulette.ultima_atualizacao = data.timestamp || new Date().toISOString();
    
    // Salvar roleta atualizada
    this.roulettes.set(roletaId, roulette);
    
    // Atualizar timestamp global
    this.lastUpdate = roulette.ultima_atualizacao;
    
    // Emitir evento
    EventService.emitGlobalEvent('roulette_number_added', {
      roleta_id: roletaId,
      roleta_nome: roulette.nome,
      numero: numero,
      timestamp: roulette.ultima_atualizacao
    });
    
    // Notificar listeners
    this.emit('update', {
      type: 'number',
      roleta_id: roletaId,
      roleta_nome: roulette.nome,
      numero: numero,
      timestamp: roulette.ultima_atualizacao
    });
  }

  /**
   * Manipula eventos de atualização recebidos pelo stream SSE
   */
  private handleUpdateEvent(data: SSEEvent): void {
    if (!data || !data.roleta_id) {
      logger.warn('Evento SSE de atualização inválido:', data);
      return;
    }
    
    const roletaId = data.roleta_id.toString();
    
    // Verificar se a roleta está na lista de permitidas (se houver filtragem)
    if (ROLETAS_PERMITIDAS.length > 0 && !ROLETAS_PERMITIDAS.includes(roletaId)) {
      return;
    }
    
    // Obter roleta existente ou criar nova
    const roulette = this.roulettes.get(roletaId) || {
      id: roletaId,
      nome: data.roleta_nome || `Roleta ${roletaId}`,
      numeros: []
    };
    
    // Atualizar campos da roleta
    Object.keys(data).forEach(key => {
      if (key !== 'roleta_id' && key !== 'roleta_nome' && key !== 'tipo') {
        roulette[key] = data[key];
      }
    });
    
    // Atualizar nome se fornecido
    if (data.roleta_nome) {
      roulette.nome = data.roleta_nome;
    }
    
    // Atualizar timestamp
    roulette.ultima_atualizacao = data.timestamp || new Date().toISOString();
    
    // Salvar roleta atualizada
    this.roulettes.set(roletaId, roulette);
    
    // Atualizar timestamp global
    this.lastUpdate = roulette.ultima_atualizacao;
    
    // Emitir evento
    EventService.emitGlobalEvent('roulette_updated', {
      roleta_id: roletaId,
      roleta_nome: roulette.nome,
      timestamp: roulette.ultima_atualizacao,
      ...data
    });
    
    // Notificar listeners
    this.emit('update', {
      type: 'update',
      roleta_id: roletaId,
      roleta_nome: roulette.nome,
      timestamp: roulette.ultima_atualizacao,
      ...data
    });
  }
  
  /**
   * Manipula eventos de atualização em massa de todas as roletas
   */
  private handleAllRoulettesUpdate(data: SSEEvent): void {
    if (!data || !data.data || !Array.isArray(data.data)) {
      logger.warn('Evento de atualização em massa inválido:', data);
      return;
    }
    
    logger.info(`Recebida atualização em massa com ${data.data.length} roletas`);
    const timestamp = data._timestamp ? new Date(data._timestamp).toISOString() : new Date().toISOString();
    
    // Processar cada roleta na atualização em massa
    data.data.forEach((roletaData: any) => {
      if (!roletaData || !roletaData.id) return;
      
      const roletaId = roletaData.id.toString();
      
      // Verificar se a roleta está na lista de permitidas (se houver filtragem)
      if (ROLETAS_PERMITIDAS.length > 0 && !ROLETAS_PERMITIDAS.includes(roletaId)) {
        return;
      }
      
      // Obter roleta existente ou criar nova
      const existingRoulette = this.roulettes.get(roletaId);
      let numerosArray: number[] = [];
      
      // Processar números da roleta
      if (roletaData.numeros && Array.isArray(roletaData.numeros)) {
        numerosArray = this.normalizeNumbersArray(roletaData.numeros);
      } else if (roletaData.numero && Array.isArray(roletaData.numero)) {
        numerosArray = this.normalizeNumbersArray(roletaData.numero);
      } else if (existingRoulette?.numeros) {
        numerosArray = [...existingRoulette.numeros];
      }
      
      // Criar ou atualizar roleta
      const updatedRoulette: RouletteData = {
        ...roletaData,
        id: roletaId,
        nome: roletaData.nome || roletaData.name || `Roleta ${roletaId}`,
        numeros: numerosArray,
        ultima_atualizacao: roletaData.timestamp || timestamp
      };
      
      // Salvar roleta atualizada
      this.roulettes.set(roletaId, updatedRoulette);
      
      // Emitir evento individual para cada roleta atualizada
      this.emit('update', {
        type: 'update',
        roleta_id: roletaId,
        roleta_nome: updatedRoulette.nome,
        timestamp: updatedRoulette.ultima_atualizacao
      });
    });
    
    // Atualizar timestamp global
    this.lastUpdate = timestamp;
    
    // Emitir evento global de atualização em massa
    EventService.emitGlobalEvent('roulettes_updated', {
      count: data.data.length,
      timestamp: this.lastUpdate,
      source: 'stream'
    });
  }

  /**
   * Retorna todas as roletas
   */
  public getAllRoulettes(): RouletteData[] {
    return Array.from(this.roulettes.values());
  }

  /**
   * Busca uma roleta específica pelo ID
   */
  public getRouletteById(roletaId: string): RouletteData | undefined {
    return this.roulettes.get(roletaId);
  }

  /**
   * Força atualização dos dados
   * 1. Busca dados históricos via REST
   * 2. Reconecta ao stream SSE
   */
  public async forceUpdate(): Promise<void> {
    logger.info('Forçando atualização de dados: buscando históricos e reconectando ao stream SSE.');
    
    // Buscar dados históricos
    await this.fetchInitialRouletteData();
    
    // Desconecta e reconecta o stream para garantir que pegue as últimas atualizações
    this.disconnectStream();
    this.connectStream();
  }

  /**
   * Retorna o status atual do cliente
   */
  public getStatus(): ClientStatus {
    return {
      isConnected: this.roulettes.size > 0,
      isStreamConnected: this.isStreamConnected,
      isFetchingInitialData: this.isFetchingInitial,
      lastUpdate: this.lastUpdate,
      source: this.isStreamConnected ? 'stream' : (this.isFetchingInitial ? 'api' : 'disconnected'),
      rouletteCount: this.roulettes.size
    };
  }

  /**
   * Solicita os números mais recentes
   * Se conectado ao stream SSE, verifica a conexão
   * Se não conectado, tenta reconectar
   */
  public requestRecentNumbers(): void {
    if (this.isStreamConnected && this.eventSource) {
      logger.debug('Cliente conectado ao stream SSE. Para dados recentes, confiar no stream ou em uma nova carga inicial via forceUpdate.');
    } else {
      logger.warn('Stream SSE não conectado. Tentando reconectar para obter dados.');
      if(!this.isStreamConnected && !this.isConnecting) {
        this.connectStream();
      }
    }
  }

  /**
   * Libera recursos
   */
  public dispose(): void {
    logger.info('Liberando recursos do UnifiedRouletteClient');
    this.disconnectStream();
    
    // Limpar listeners
    for (const listeners of this.eventListeners.values()) {
      listeners.clear();
    }
    this.eventListeners.clear();
  }
}

export default UnifiedRouletteClient; 