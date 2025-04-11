import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

// URL do serviço de API externa
const WEBSOCKET_SERVICE_URL = "https://backend-production-2f96.up.railway.app";

// Intervalo de polling padrão em milissegundos (8 segundos)
const POLLING_INTERVAL = 8000;

// Tempo de vida do cache em milissegundos (15 segundos)
const CACHE_TTL = 15000;

// Intervalo mínimo entre requisições forçadas (2 segundos)
const MIN_FORCE_INTERVAL = 2000;

// Limite padrão para requisições normais (100 itens)
const DEFAULT_LIMIT = 100;

// Limite para requisições detalhadas (1000 itens)
const DETAILED_LIMIT = 1000;

// Tipo para os callbacks de inscrição
type SubscriberCallback = () => void;

/**
 * Serviço Global para centralizar requisições de dados das roletas
 * Este serviço implementa o padrão Singleton para garantir apenas uma instância
 * e evitar múltiplas requisições à API
 */
class GlobalRouletteDataService {
  private static instance: GlobalRouletteDataService;
  
  // Dados e estado
  private rouletteData: any[] = [];
  private detailedRouletteData: any[] = [];
  private lastFetchTime: number = 0;
  private lastDetailedFetchTime: number = 0;
  private isFetching: boolean = false;
  private isFetchingDetailed: boolean = false;
  private pollingTimer: number | null = null;
  private subscribers: Map<string, SubscriberCallback> = new Map();
  private detailedSubscribers: Map<string, SubscriberCallback> = new Map();
  
  // Construtor privado para garantir Singleton
  private constructor() {
    console.log('[GlobalRouletteService] Inicializando serviço global de roletas');
    this.startPolling();
  }

  /**
   * Obtém a instância única do serviço
   */
  public static getInstance(): GlobalRouletteDataService {
    if (!GlobalRouletteDataService.instance) {
      GlobalRouletteDataService.instance = new GlobalRouletteDataService();
    }
    return GlobalRouletteDataService.instance;
  }

  /**
   * Inicia o processo de polling
   */
  private startPolling(): void {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
    }
    
    // Buscar dados imediatamente
    this.fetchRouletteData();
    
    // Configurar polling
    this.pollingTimer = window.setInterval(() => {
      this.fetchRouletteData();
    }, POLLING_INTERVAL) as unknown as number;
    
    console.log(`[GlobalRouletteService] Polling iniciado com intervalo de ${POLLING_INTERVAL}ms`);
    
    // Adicionar manipuladores de visibilidade para pausar quando a página não estiver visível
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('focus', this.resumePolling);
    window.addEventListener('blur', this.handleVisibilityChange);
  }
  
  /**
   * Pausa o polling quando a página não está visível
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden || document.visibilityState === 'hidden') {
      console.log('[GlobalRouletteService] Página não visível, pausando polling');
      if (this.pollingTimer) {
        window.clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
    } else {
      this.resumePolling();
    }
  }
  
  /**
   * Retoma o polling quando a página fica visível novamente
   */
  private resumePolling = (): void => {
    if (!this.pollingTimer) {
      console.log('[GlobalRouletteService] Retomando polling');
      this.fetchRouletteData(); // Buscar dados imediatamente
      this.pollingTimer = window.setInterval(() => {
        this.fetchRouletteData();
      }, POLLING_INTERVAL) as unknown as number;
    }
  }
  
  /**
   * Busca dados atualizados da API (usando a rota otimizada /API/NUMBERS)
   */
  private async fetchRouletteData(): Promise<void> {
    // Evitar requisições simultâneas
    if (this.isFetching) {
      console.log('[GlobalRouletteService] Requisição já em andamento, ignorando');
      return;
    }
    
    try {
      const now = Date.now();
      this.isFetching = true;
      
      // Verificar se os dados em cache ainda são válidos
      if (this.rouletteData.length > 0 && now - this.lastFetchTime < CACHE_TTL) {
        console.log(`[GlobalRouletteService] Usando dados em cache, idade: ${Math.round((now - this.lastFetchTime)/1000)}s`);
        return;
      }
      
      console.log('[GlobalRouletteService] Buscando dados atualizados da API (números recentes)');
      
      // Usar a função utilitária com suporte a CORS - com a nova URL para números recentes
      const response = await fetchWithCorsSupport<any>(`${WEBSOCKET_SERVICE_URL}/API/NUMBERS`);
      
      // Determinar o formato da resposta e extrair os dados
      let numbersData: any[] = [];
      
      if (response) {
        // Caso 1: A resposta é um objeto com propriedade 'data' que contém a array
        if (response.data && Array.isArray(response.data)) {
          console.log(`[GlobalRouletteService] Resposta no formato objeto.data: ${response.data.length} itens`);
          numbersData = response.data;
        } 
        // Caso 2: A resposta é uma array diretamente
        else if (Array.isArray(response)) {
          console.log(`[GlobalRouletteService] Resposta no formato array direta: ${response.length} itens`);
          numbersData = response;
        }
        // Caso 3: A resposta tem um formato diferente, mas contém números na propriedade 'data'
        else if (typeof response === 'object' && response !== null) {
          for (const key in response) {
            if (Array.isArray(response[key])) {
              console.log(`[GlobalRouletteService] Dados encontrados na propriedade '${key}': ${response[key].length} itens`);
              numbersData = response[key];
              break;
            }
          }
        }
      }
      
      if (numbersData.length > 0) {
        console.log(`[GlobalRouletteService] Dados recebidos com sucesso: ${numbersData.length} números recentes`);
        
        // Log para debug dos primeiros itens
        console.log('Amostra dos dados:', numbersData.slice(0, 2));
        
        // Processar os dados para o formato esperado pelo resto da aplicação
        const processedData = this.processNumbersToRouletteFormat(numbersData);
        
        this.rouletteData = processedData;
        this.lastFetchTime = now;
        
        // Notificar todos os assinantes sobre a atualização
        this.notifySubscribers();
        
        // Emitir evento global para outros componentes que possam estar ouvindo
        EventService.emit('roulette:data-updated', {
          timestamp: new Date().toISOString(),
          count: processedData.length
        });
      } else {
        console.error('[GlobalRouletteService] Resposta inválida da API de números recentes', response);
      }
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
    } finally {
      this.isFetching = false;
    }
  }
  
  /**
   * Processa dados da API de números para o formato de roletas esperado pela aplicação
   */
  private processNumbersToRouletteFormat(numbersData: any[]): any[] {
    // Agrupar números por roleta_id
    const rouletteMap = new Map<string, any>();
    
    // Para cada número recebido
    numbersData.forEach(numberEntry => {
      const { roleta_id, roleta_nome, numero, cor, timestamp } = numberEntry;
      
      // Se essa roleta ainda não está no mapa, criá-la
      if (!rouletteMap.has(roleta_id)) {
        rouletteMap.set(roleta_id, {
          id: roleta_id,
          nome: roleta_nome,
          ativa: true,
          numero: [],
          estado_estrategia: "NEUTRAL"
        });
      }
      
      // Obter a roleta atual
      const roulette = rouletteMap.get(roleta_id);
      
      // Adicionar o número à lista de números da roleta
      roulette.numero.push({
        numero: numero,
        roleta_id: roleta_id,
        roleta_nome: roleta_nome,
        cor: cor,
        timestamp: timestamp
      });
    });
    
    // Converter o mapa para array
    return Array.from(rouletteMap.values());
  }
  
  /**
   * Busca dados detalhados - apenas para visualizações detalhadas
   * Esta função deve ser chamada somente quando precisamos de dados detalhados para estatísticas
   */
  public async fetchDetailedRouletteData(): Promise<any[]> {
    // Evitar requisições simultâneas
    if (this.isFetchingDetailed) {
      console.log('[GlobalRouletteService] Requisição detalhada já em andamento, ignorando');
      return this.detailedRouletteData;
    }
    
    try {
      const now = Date.now();
      this.isFetchingDetailed = true;
      
      // Verificar se os dados detalhados em cache ainda são válidos
      if (this.detailedRouletteData.length > 0 && now - this.lastDetailedFetchTime < CACHE_TTL) {
        console.log(`[GlobalRouletteService] Usando dados detalhados em cache, idade: ${Math.round((now - this.lastDetailedFetchTime)/1000)}s`);
        return this.detailedRouletteData;
      }
      
      console.log('[GlobalRouletteService] Buscando dados detalhados da API externa');
      
      // Usar a função utilitária com suporte a CORS, usando a URL do serviço WebSocket
      const response = await fetchWithCorsSupport<any>(`${WEBSOCKET_SERVICE_URL}/API/NUMBERS?limit=${DETAILED_LIMIT}`);
      
      // Determinar o formato da resposta e extrair os dados
      let numbersData: any[] = [];
      
      if (response) {
        // Caso 1: A resposta é um objeto com propriedade 'data' que contém a array
        if (response.data && Array.isArray(response.data)) {
          console.log(`[GlobalRouletteService] Resposta detalhada no formato objeto.data: ${response.data.length} itens`);
          numbersData = response.data;
        } 
        // Caso 2: A resposta é uma array diretamente
        else if (Array.isArray(response)) {
          console.log(`[GlobalRouletteService] Resposta detalhada no formato array direta: ${response.length} itens`);
          numbersData = response;
        }
        // Caso 3: A resposta tem um formato diferente, mas contém números em alguma propriedade
        else if (typeof response === 'object' && response !== null) {
          for (const key in response) {
            if (Array.isArray(response[key])) {
              console.log(`[GlobalRouletteService] Dados detalhados encontrados na propriedade '${key}': ${response[key].length} itens`);
              numbersData = response[key];
              break;
            }
          }
        }
      }
      
      if (numbersData.length > 0) {
        console.log(`[GlobalRouletteService] Dados detalhados recebidos: ${numbersData.length} números`);
        
        // Processar os dados detalhados
        const processedData = this.processNumbersToRouletteFormat(numbersData);
        
        this.detailedRouletteData = processedData;
        this.lastDetailedFetchTime = now;
        
        // Notificar assinantes de dados detalhados
        this.notifyDetailedSubscribers();
      } else {
        console.error('[GlobalRouletteService] Resposta inválida da API detalhada', response);
      }
      
      return this.detailedRouletteData;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados detalhados:', error);
      return this.detailedRouletteData;
    } finally {
      this.isFetchingDetailed = false;
    }
  }
  
  /**
   * Força uma atualização imediata dos dados
   */
  public forceUpdate(): void {
    const now = Date.now();
    
    // Verificar se a última requisição foi recente demais
    if (now - this.lastFetchTime < MIN_FORCE_INTERVAL) {
      console.log(`[GlobalRouletteService] Requisição forçada muito próxima da anterior (${now - this.lastFetchTime}ms), ignorando`);
      return;
    }
    
    console.log('[GlobalRouletteService] Forçando atualização de dados');
    this.fetchRouletteData();
  }
  
  /**
   * Retorna a roleta pelo nome
   */
  public getRouletteByName(rouletteName: string): any {
    if (!this.rouletteData || this.rouletteData.length === 0) {
      return null;
    }
    
    // Procurar a roleta pelo nome (insensível a maiúsculas/minúsculas)
    return this.rouletteData.find((roleta: any) => {
      const roletaName = roleta.nome || roleta.name || '';
      return roletaName.toLowerCase() === rouletteName.toLowerCase();
    });
  }
  
  /**
   * Retorna todas as roletas disponíveis (dados básicos)
   */
  public getAllRoulettes(): any[] {
    return this.rouletteData || [];
  }
  
  /**
   * Retorna dados detalhados de todas as roletas (dados completos)
   */
  public getAllDetailedRoulettes(): any[] {
    // Se não temos dados detalhados, usar os dados normais como fallback
    return this.detailedRouletteData.length > 0 ? this.detailedRouletteData : this.rouletteData;
  }
  
  /**
   * Inscreve um componente para receber atualizações de dados básicos
   */
  public subscribe(id: string, callback: SubscriberCallback): void {
    console.log(`[GlobalRouletteService] Novo assinante registrado: ${id}`);
    this.subscribers.set(id, callback);
    
    // Se já tivermos dados, notificar o novo assinante imediatamente
    if (this.rouletteData.length > 0) {
      setTimeout(() => callback(), 0);
    }
  }
  
  /**
   * Inscreve um componente para receber atualizações de dados detalhados
   */
  public subscribeToDetailedData(id: string, callback: SubscriberCallback): void {
    console.log(`[GlobalRouletteService] Novo assinante para dados detalhados: ${id}`);
    this.detailedSubscribers.set(id, callback);
    
    // Se já tivermos dados detalhados, notificar o novo assinante imediatamente
    if (this.detailedRouletteData.length > 0) {
      setTimeout(() => callback(), 0);
    } else {
      // Se não temos dados detalhados ainda, buscar
      this.fetchDetailedRouletteData();
    }
  }
  
  /**
   * Cancela a inscrição de um componente
   */
  public unsubscribe(id: string): void {
    console.log(`[GlobalRouletteService] Assinante removido: ${id}`);
    this.subscribers.delete(id);
    this.detailedSubscribers.delete(id);
  }
  
  /**
   * Notifica todos os assinantes sobre a atualização de dados básicos
   */
  private notifySubscribers(): void {
    console.log(`[GlobalRouletteService] Notificando ${this.subscribers.size} assinantes`);
    this.subscribers.forEach(callback => {
      try {
        // Executar callbacks em um setTimeout para evitar bloqueios
        setTimeout(() => callback(), 0);
      } catch (error) {
        console.error('[GlobalRouletteService] Erro ao notificar assinante:', error);
      }
    });
  }
  
  /**
   * Notifica assinantes de dados detalhados
   */
  private notifyDetailedSubscribers(): void {
    console.log(`[GlobalRouletteService] Notificando ${this.detailedSubscribers.size} assinantes de dados detalhados`);
    this.detailedSubscribers.forEach(callback => {
      try {
        setTimeout(() => callback(), 0);
      } catch (error) {
        console.error('[GlobalRouletteService] Erro ao notificar assinante de dados detalhados:', error);
      }
    });
  }
  
  /**
   * Limpa todos os recursos ao desmontar
   */
  public dispose(): void {
    if (this.pollingTimer) {
      window.clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('focus', this.resumePolling);
    window.removeEventListener('blur', this.handleVisibilityChange);
    
    this.subscribers.clear();
    this.detailedSubscribers.clear();
    console.log('[GlobalRouletteService] Serviço encerrado e recursos liberados');
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService; 