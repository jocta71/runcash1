/**
 * Cliente unificado para dados das roletas
 * Centraliza acesso aos dados de roletas de diferentes fontes
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
  isConnected: boolean;
  isStreamConnected: boolean;
  lastUpdate: string;
  source: string;
}

class UnifiedRouletteClient {
  private static instance: UnifiedRouletteClient;
  private roulettes: Map<string, RouletteData> = new Map();
  private eventSource: EventSource | null = null;
  private isStreamingEnabled: boolean = true;
  private isStreamConnected: boolean = false;
  private lastUpdate: string = '';
  private streamUrl: string = '';
  private pollingInterval: number | null = null;
  private eventService: EventService;

  private constructor(options?: ClientOptions) {
    this.eventService = EventService.getInstance();
    
    // Configurar com base nas opções
    if (options) {
      this.isStreamingEnabled = options.streamingEnabled !== false;
      
      if (options.autoConnect === true) {
        if (this.isStreamingEnabled) {
          this.connectStream();
        }
      }
    }
    
    logger.info('UnifiedRouletteClient inicializado');
  }

  /**
   * Obtém a única instância do cliente (padrão Singleton)
   */
  public static getInstance(options?: ClientOptions): UnifiedRouletteClient {
    if (!UnifiedRouletteClient.instance) {
      UnifiedRouletteClient.instance = new UnifiedRouletteClient(options);
    } else if (options) {
      // Atualizar opções da instância existente
      if (options.streamingEnabled !== undefined) {
        UnifiedRouletteClient.instance.isStreamingEnabled = options.streamingEnabled;
      }
      if (options.autoConnect === true) {
        if (UnifiedRouletteClient.instance.isStreamingEnabled) {
          UnifiedRouletteClient.instance.connectStream();
        }
      }
    }
    return UnifiedRouletteClient.instance;
  }

  /**
   * Conecta ao stream de eventos SSE
   */
  public connectStream(): boolean {
    if (!this.isStreamingEnabled) {
      logger.info('Streaming está desativado, não conectando ao stream');
      return false;
    }
    
    if (this.eventSource) {
      logger.info('Stream já está conectado');
      return true;
    }
    
    try {
      // Usar a URL da API do config
      this.streamUrl = `${config.apiBaseUrl}/sse-roulettes`;
      
      logger.info(`Conectando ao stream em: ${this.streamUrl}`);
      
      this.eventSource = new EventSource(this.streamUrl);
      
      this.eventSource.onopen = () => {
        logger.info('Stream SSE conectado com sucesso');
        this.isStreamConnected = true;
        this.lastUpdate = new Date().toISOString();
        
        // Emitir evento de conexão
        EventService.emitGlobalEvent('roulette_stream_connected', {
          timestamp: this.lastUpdate,
          url: this.streamUrl
        });
      };
      
      this.eventSource.onerror = (error) => {
        logger.error('Erro na conexão SSE:', error);
        this.isStreamConnected = false;
        
        // Tentar reconectar automaticamente
        setTimeout(() => {
          if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.connectStream();
          }
        }, 5000);
        
        // Emitir evento de erro
        EventService.emitGlobalEvent('roulette_stream_error', {
          timestamp: new Date().toISOString(),
          error: 'Erro na conexão SSE'
        });
      };
      
      // Ouvir eventos de números
      this.eventSource.addEventListener('number', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleNumberEvent(data);
        } catch (error) {
          logger.error('Erro ao processar evento de número:', error);
        }
      });
      
      // Ouvir eventos de atualização de roletas
      this.eventSource.addEventListener('update', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleUpdateEvent(data);
        } catch (error) {
          logger.error('Erro ao processar evento de atualização:', error);
        }
      });
      
      return true;
    } catch (error) {
      logger.error('Erro ao conectar ao stream:', error);
      this.isStreamConnected = false;
      return false;
    }
  }

  /**
   * Desconecta do stream de eventos
   */
  public disconnectStream(): void {
    if (this.eventSource) {
      logger.info('Desconectando do stream SSE');
      this.eventSource.close();
      this.eventSource = null;
      this.isStreamConnected = false;
    }
    
    // Limpar intervalo de polling se estiver ativo
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Processa eventos de números recebidos
   */
  private handleNumberEvent(data: any): void {
    if (!data || !data.roleta_id || data.numero === undefined) {
      logger.warn('Evento de número inválido:', data);
      return;
    }
    
    const roletaId = data.roleta_id;
    const roletaNome = data.roleta_nome || 'Roleta sem nome';
    const numero = typeof data.numero === 'number' ? data.numero : 
                  typeof data.numero === 'string' ? parseInt(data.numero, 10) : 0;
    
    logger.debug(`Número recebido: ${roletaNome} - ${numero}`);
    
    // Atualizar dados internos
    const roleta = this.roulettes.get(roletaId) || {
      id: roletaId,
      nome: roletaNome,
      numeros: []
    };
    
    const numeros = Array.isArray(roleta.numeros) ? roleta.numeros : [];
    numeros.unshift(numero);
    
    // Limitar a 100 números
    if (numeros.length > 100) {
      numeros.length = 100;
    }
    
    // Atualizar roleta
    this.roulettes.set(roletaId, {
      ...roleta,
      numeros,
      ultima_atualizacao: new Date().toISOString()
    });
    
    // Criar evento para o EventService
    const event: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      numero: numero,
      timestamp: new Date().toISOString()
    };
    
    // Emitir evento
    this.eventService.dispatchEvent(event);
  }

  /**
   * Processa eventos de atualização recebidos
   */
  private handleUpdateEvent(data: any): void {
    if (!data || !data.roletas || !Array.isArray(data.roletas)) {
      logger.warn('Evento de atualização inválido:', data);
      return;
    }
    
    logger.info(`Recebida atualização com ${data.roletas.length} roletas`);
    
    // Atualizar dados internos para cada roleta
    data.roletas.forEach((roleta: any) => {
      if (!roleta || !roleta.id) return;
      
      const roletaId = roleta.id;
      
      // Verificar se é uma roleta permitida
      if (!ROLETAS_PERMITIDAS.includes(roletaId)) {
        return;
      }
      
      // Obter roleta existente ou criar nova
      const existingRoleta = this.roulettes.get(roletaId) || {
        id: roletaId,
        nome: roleta.nome || 'Roleta sem nome',
        numeros: []
      };
      
      // Atualizar números se presentes
      if (roleta.numeros && Array.isArray(roleta.numeros)) {
        existingRoleta.numeros = roleta.numeros;
      } else if (roleta.numero) {
        // Tentar extrair números do campo numero caso seja um array
        if (Array.isArray(roleta.numero)) {
          existingRoleta.numeros = roleta.numero.map((item: any) => {
            if (typeof item === 'object' && item.numero !== undefined) {
              return Number(item.numero);
            }
            return Number(item);
          });
        }
      }
      
      // Atualizar a roleta
      this.roulettes.set(roletaId, {
        ...existingRoleta,
        ...roleta,
        ultima_atualizacao: new Date().toISOString()
      });
    });
    
    this.lastUpdate = new Date().toISOString();
    
    // Emitir evento de atualização
    EventService.emitGlobalEvent('roulettes_updated', {
      count: data.roletas.length,
      timestamp: this.lastUpdate,
      source: 'stream'
    });
  }

  /**
   * Busca dados das roletas via API REST
   */
  public async fetchRouletteData(): Promise<RouletteData[]> {
    try {
      logger.info('Buscando dados das roletas via API REST');
      
      const response = await fetch(`${config.apiBaseUrl}/roulettes`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Resposta inválida: não é um array');
      }
      
      logger.info(`Recebidos dados de ${data.length} roletas`);
      
      // Processar dados e atualizar cache interno
      data.forEach(roleta => {
        if (!roleta || !roleta.id) return;
        
        const roletaId = roleta.id;
        
        // Verificar se é uma roleta permitida
        if (!ROLETAS_PERMITIDAS.includes(roletaId)) {
          return;
        }
        
        // Obter roleta existente ou criar nova
        const existingRoleta = this.roulettes.get(roletaId) || {
          id: roletaId,
          nome: roleta.nome || 'Roleta sem nome',
          numeros: []
        };
        
        // Processar dados
        this.roulettes.set(roletaId, {
          ...existingRoleta,
          ...roleta,
          ultima_atualizacao: new Date().toISOString()
        });
      });
      
      this.lastUpdate = new Date().toISOString();
      
      // Emitir evento
      EventService.emitGlobalEvent('roulettes_loaded', {
        count: data.length,
        timestamp: this.lastUpdate,
        source: 'api'
      });
      
      return Array.from(this.roulettes.values());
    } catch (error) {
      logger.error('Erro ao buscar dados das roletas:', error);
      throw error;
    }
  }

  /**
   * Obtém todas as roletas
   */
  public getAllRoulettes(): RouletteData[] {
    return Array.from(this.roulettes.values());
  }

  /**
   * Obtém uma roleta específica pelo ID
   */
  public getRouletteById(roletaId: string): RouletteData | undefined {
    return this.roulettes.get(roletaId);
  }

  /**
   * Força uma atualização dos dados das roletas
   */
  public async forceUpdate(): Promise<RouletteData[]> {
    return await this.fetchRouletteData();
  }

  /**
   * Obtém o status do cliente
   */
  public getStatus(): ClientStatus {
    return {
      isConnected: this.roulettes.size > 0,
      isStreamConnected: this.isStreamConnected,
      lastUpdate: this.lastUpdate,
      source: this.isStreamConnected ? 'stream' : 'api'
    };
  }
  
  /**
   * Envia uma solicitação para obter números recentes
   */
  public requestRecentNumbers(): void {
    if (this.eventSource && this.isStreamConnected) {
      logger.debug('Solicitando números recentes via SSE');
      
      // Enviar evento para o servidor pedindo números recentes
      // Note: Isso só funcionará se o servidor suportar essa funcionalidade
      try {
        // Como não podemos enviar mensagens via SSE, vamos usar uma chamada fetch
        fetch(`${config.apiBaseUrl}/request-recent-numbers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true'
          },
          body: JSON.stringify({
            requestTime: new Date().toISOString()
          })
        }).catch(error => {
          logger.error('Erro ao solicitar números recentes:', error);
        });
      } catch (error) {
        logger.error('Erro ao solicitar números recentes:', error);
      }
    } else {
      // Se não tiver stream, buscar via API
      this.fetchRouletteData().catch(error => {
        logger.error('Erro ao buscar dados recentes:', error);
      });
    }
  }
  
  /**
   * Libera recursos do cliente
   */
  public dispose(): void {
    logger.info('Liberando recursos do cliente');
    
    this.disconnectStream();
    this.roulettes.clear();
    
    // Emitir evento
    EventService.emitGlobalEvent('roulette_client_disposed', {
      timestamp: new Date().toISOString()
    });
  }
}

export default UnifiedRouletteClient; 