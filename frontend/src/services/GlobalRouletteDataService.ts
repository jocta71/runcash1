import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

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
  private _currentFetchPromise: Promise<any[]> | null = null;
  
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
   * Busca dados das roletas da API (usando limit=100) - método principal
   * @returns Promise com dados das roletas
   */
  public async fetchRouletteData(): Promise<any[]> {
    // Evitar requisições simultâneas
    if (this.isFetching) {
      console.log('[GlobalRouletteService] Requisição já em andamento, aguardando...');
      
      // Aguardar a conclusão da requisição atual
      if (this._currentFetchPromise) {
        return this._currentFetchPromise;
      }
      
      return this.rouletteData;
    }
    
    try {
      const now = Date.now();
      this.isFetching = true;
      
      // Verificar se os dados em cache ainda são válidos
      if (this.rouletteData.length > 0 && now - this.lastFetchTime < CACHE_TTL) {
        console.log(`[GlobalRouletteService] Usando dados em cache, idade: ${Math.round((now - this.lastFetchTime)/1000)}s`);
        return this.rouletteData;
      }
      
      console.log('[GlobalRouletteService] Buscando dados atualizados da API (limit=100)');
      
      // Criar e armazenar a promessa atual
      this._currentFetchPromise = (async () => {
        // Usar a função utilitária com suporte a CORS - com limit=100 para polling regular
        const data = await fetchWithCorsSupport<any[]>(`/api/ROULETTES?limit=${DEFAULT_LIMIT}`);
        
        // Verificar se os dados são válidos
        if (data && Array.isArray(data)) {
          console.log(`[GlobalRouletteService] Dados recebidos com sucesso: ${data.length} roletas`);
          this.rouletteData = data;
          this.lastFetchTime = now;
          
          // Armazenar no localStorage para compartilhamento
          localStorage.setItem('global_roulette_data', JSON.stringify({
            timestamp: now,
            data: data
          }));
          
          // Notificar todos os assinantes sobre a atualização
          this.notifySubscribers();
          
          // Emitir evento global para outros componentes que possam estar ouvindo
          EventService.emit('roulette:data-updated', {
            timestamp: new Date().toISOString(),
            count: data.length,
            source: 'central-service'
          });
          
          return data;
        } else {
          console.error('[GlobalRouletteService] Resposta inválida da API');
          return this.rouletteData;
        }
      })();
      
      return await this._currentFetchPromise;
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados:', error);
      return this.rouletteData;
    } finally {
      this.isFetching = false;
      this._currentFetchPromise = null;
    }
  }
  
  /**
   * Busca dados detalhados (usando limit=1000) - apenas para visualizações detalhadas
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
      
      console.log('[GlobalRouletteService] Buscando dados detalhados (limit=1000)');
      console.log(`[GlobalRouletteService] URL completa: /api/ROULETTES?limit=${DETAILED_LIMIT}`);
      
      // Usar a função utilitária com suporte a CORS - com limit=1000 para dados detalhados
      const data = await fetchWithCorsSupport<any[]>(`/api/ROULETTES?limit=${DETAILED_LIMIT}`);
      
      // Verificar se os dados são válidos
      if (data && Array.isArray(data)) {
        console.log(`[GlobalRouletteService] Dados detalhados recebidos: ${data.length} roletas com um total de ${this.contarNumerosTotais(data)} números`);
        this.detailedRouletteData = data;
        this.lastDetailedFetchTime = now;
        
        // Notificar assinantes de dados detalhados
        this.notifyDetailedSubscribers();
        
        return this.detailedRouletteData;
      } else {
        console.error('[GlobalRouletteService] Resposta inválida da API detalhada');
        return this.detailedRouletteData;
      }
    } catch (error) {
      console.error('[GlobalRouletteService] Erro ao buscar dados detalhados:', error);
      return this.detailedRouletteData;
    } finally {
      this.isFetchingDetailed = false;
    }
  }
  
  /**
   * Conta o número total de números em todas as roletas
   */
  private contarNumerosTotais(roletas: any[]): number {
    let total = 0;
    roletas.forEach(roleta => {
      if (roleta.numero && Array.isArray(roleta.numero)) {
        total += roleta.numero.length;
      }
    });
    return total;
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

  // Método para adicionar um novo número a uma roleta específica
  public addNewNumberToRoulette(rouletteName: string, newNumber: number): void {
    // Verificar se temos dados
    if (!this.rouletteData || this.rouletteData.length === 0) {
      console.log(`[GlobalRouletteService] Tentativa de adicionar número ${newNumber} a ${rouletteName}, mas não há dados carregados`);
      return;
    }
    
    console.log(`[GlobalRouletteService] Adicionando número ${newNumber} à roleta ${rouletteName}`);
    
    try {
      // Encontrar a roleta específica
      const targetRouletteIndex = this.rouletteData.findIndex((roleta: any) => {
        const name = roleta.nome || roleta.name || '';
        return name.toLowerCase() === rouletteName.toLowerCase();
      });
      
      // Se não encontrar a roleta, não podemos adicionar o número
      if (targetRouletteIndex === -1) {
        console.log(`[GlobalRouletteService] Roleta ${rouletteName} não encontrada para adicionar número ${newNumber}`);
        return;
      }
      
      // Adicionar o número à roleta encontrada
      const targetRoulette = this.rouletteData[targetRouletteIndex];
      
      // Criar objeto com timestamp para o novo número
      const timestamp = new Date().toISOString();
      const newNumberObj = { numero: newNumber, timestamp };
      
      // LOG para debug
      console.log(`[GlobalRouletteService] Criado objeto para novo número: `, newNumberObj);
      
      // Adicionar aos arrays de números, verificando qual estrutura existe
      if (Array.isArray(targetRoulette.numero)) {
        // Verificar se o número já existe no início do array para evitar duplicatas imediatas
        if (targetRoulette.numero.length > 0 && 
            targetRoulette.numero[0].numero === newNumber) {
          console.log(`[GlobalRouletteService] Número ${newNumber} já é o mais recente na roleta ${rouletteName}, ignorando`);
          return;
        }
        
        // Adicionar no início do array numero
        targetRoulette.numero.unshift(newNumberObj);
        console.log(`[GlobalRouletteService] Número adicionado à lista normal, agora com ${targetRoulette.numero.length} números`);
      } else {
        // Criar array se não existir
        targetRoulette.numero = [newNumberObj];
        console.log(`[GlobalRouletteService] Criada nova lista de números para a roleta`);
      }
      
      // Fazer o mesmo para os dados detalhados se eles existirem
      if (this.detailedRouletteData && this.detailedRouletteData.length > 0) {
        const detailedRouletteIndex = this.detailedRouletteData.findIndex((roleta: any) => {
          const name = roleta.nome || roleta.name || '';
          return name.toLowerCase() === rouletteName.toLowerCase();
        });
        
        if (detailedRouletteIndex !== -1) {
          const detailedRoulette = this.detailedRouletteData[detailedRouletteIndex];
          
          if (Array.isArray(detailedRoulette.numero)) {
            // Verificar se o número já existe no início do array para evitar duplicatas
            if (detailedRoulette.numero.length > 0 && 
                detailedRoulette.numero[0].numero === newNumber) {
              console.log(`[GlobalRouletteService] Número ${newNumber} já é o mais recente nos dados detalhados, ignorando`);
              // Mesmo assim continuar o processo para notificar os assinantes
            } else {
              detailedRoulette.numero.unshift(newNumberObj);
              console.log(`[GlobalRouletteService] Número adicionado à lista detalhada, agora com ${detailedRoulette.numero.length} números`);
            }
          } else {
            detailedRoulette.numero = [newNumberObj];
            console.log(`[GlobalRouletteService] Criada nova lista detalhada para a roleta`);
          }
        } else {
          console.log(`[GlobalRouletteService] Roleta ${rouletteName} não encontrada nos dados detalhados`);
        }
      }
      
      // Atualizar timestamp da última atualização
      this.lastFetchTime = Date.now();
      this.lastDetailedFetchTime = Date.now(); // Atualizar também o timestamp dos dados detalhados
      
      // Emitir evento global para outros componentes que possam estar ouvindo
      EventService.emit('roulette:number-added', {
        roleta: rouletteName,
        numero: newNumber,
        timestamp: timestamp
      });
      
      // Notificar todos os assinantes sobre a atualização
      console.log(`[GlobalRouletteService] Notificando assinantes sobre novo número ${newNumber} para ${rouletteName}`);
      
      // Usar setTimeout para garantir que a notificação ocorra após as mudanças de estado
      setTimeout(() => {
        this.notifySubscribers();
        this.notifyDetailedSubscribers();
      }, 10);
      
    } catch (error) {
      console.error(`[GlobalRouletteService] Erro ao adicionar número ${newNumber} à roleta ${rouletteName}:`, error);
    }
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 