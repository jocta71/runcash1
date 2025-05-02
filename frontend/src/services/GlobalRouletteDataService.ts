/**
 * AVISO: Este é um serviço stub para compatibilidade.
 * O GlobalRouletteDataService foi removido e substituído pelo RESTSocketService.
 * Este arquivo existe apenas para manter a compatibilidade com componentes existentes.
 */

import RESTSocketService from './RESTSocketService';

// Tipo seguro para dados de roleta
interface RouletteData {
  id?: string;
  name?: string;
  numbers?: number[];
  [key: string]: any;
}

class GlobalRouletteDataService {
  private static instance: GlobalRouletteDataService | null = null;
  private socketService: any = null;
  private isServiceAvailable: boolean = false;
  private cachedData: RouletteData[] = [];
  private _isInitialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private initAttempts: number = 0;
  private readonly MAX_INIT_ATTEMPTS = 3;
  private lastError: Error | null = null;

  constructor() {
    try {
      console.log('[GlobalRouletteDataService] Inicializando stub de compatibilidade');
      this.initService();
    } catch (error) {
      this.handleInitError(error);
    }
  }

  /**
   * Método de inicialização seguro que tenta obter o RESTSocketService
   */
  private initService(): void {
    try {
      // Verificar se já atingimos o número máximo de tentativas
      if (this.initAttempts >= this.MAX_INIT_ATTEMPTS) {
        console.warn('[GlobalRouletteDataService] Número máximo de tentativas de inicialização atingido');
        return;
      }
      
      this.initAttempts++;
      console.log(`[GlobalRouletteDataService] Tentativa ${this.initAttempts} de inicialização`);
      
      if (typeof RESTSocketService === 'undefined') {
        throw new Error('RESTSocketService não está disponível');
      }
      
      this.socketService = RESTSocketService.getInstance();
      
      if (!this.socketService) {
        throw new Error('Falha ao obter instância do RESTSocketService');
      }
      
      this.isServiceAvailable = true;
      this._isInitialized = true;
      console.warn(
        '[GlobalRouletteDataService] Serviço stub inicializado. ' +
        'Este serviço está obsoleto e será removido em versões futuras. ' + 
        'Use RESTSocketService diretamente.'
      );
    } catch (error) {
      this.handleInitError(error);
    }
  }

  /**
   * Manipulador centralizado de erros de inicialização
   */
  private handleInitError(error: unknown): void {
    this.lastError = error instanceof Error ? error : new Error(String(error));
    console.error('[GlobalRouletteDataService] Erro ao inicializar stub:', this.lastError);
    this.isServiceAvailable = false;
    this._isInitialized = false;
    
    // Definir dados de fallback vazios
    this.cachedData = [];
  }

  /**
   * Método singleton para obter a instância
   */
  public static getInstance(): GlobalRouletteDataService {
    if (!GlobalRouletteDataService.instance) {
      GlobalRouletteDataService.instance = new GlobalRouletteDataService();
    }
    return GlobalRouletteDataService.instance;
  }

  /**
   * Inicializa o serviço e garante que ele esteja pronto para uso
   */
  private ensureInitialized(): Promise<boolean> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      if (this._isInitialized) {
        resolve(true);
        return;
      }

      // Se já tentamos o máximo de vezes, apenas resolver com false
      if (this.initAttempts >= this.MAX_INIT_ATTEMPTS) {
        console.warn('[GlobalRouletteDataService] Máximo de tentativas atingido durante ensureInitialized');
        resolve(false);
        return;
      }

      try {
        this.initService();
        resolve(this._isInitialized);
      } catch (error) {
        console.error('[GlobalRouletteDataService] Erro em ensureInitialized:', error);
        resolve(false);
      }
    });

    return this.initPromise;
  }

  /**
   * Retorna o status de erro atual do serviço
   */
  public getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Força uma nova tentativa de inicialização
   */
  public reinitialize(): boolean {
    // Resetar o estado
    this.initPromise = null;
    this.initAttempts = 0;
    this._isInitialized = false;
    
    try {
      this.initService();
      return this._isInitialized;
    } catch (error) {
      this.handleInitError(error);
      return false;
    }
  }

  // Métodos de compatibilidade que simplesmente encaminham para o RESTSocketService
  public async fetchDetailedRouletteData(): Promise<RouletteData[]> {
    try {
      await this.ensureInitialized();
      
      if (!this.isServiceAvailable) {
        console.warn('[GlobalRouletteDataService] Service não disponível, retornando dados de cache ou array vazio');
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      if (!this.socketService) {
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      // Verificar se o método existe antes de chamar
      if (typeof this.socketService.fetchDetailedRouletteData !== 'function') {
        console.warn('[GlobalRouletteDataService] Método fetchDetailedRouletteData não encontrado no socketService');
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      const data = await this.socketService.fetchDetailedRouletteData();
      
      // Validar os dados recebidos e atualizar cache apenas se válidos
      if (Array.isArray(data) && data.length > 0) {
        this.cachedData = data;
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[GlobalRouletteDataService] Erro em fetchDetailedRouletteData:', error);
      return this.cachedData.length > 0 ? this.cachedData : [];
    }
  }

  public getAllDetailedRoulettes(): RouletteData[] {
    try {
      if (!this.isServiceAvailable || !this.socketService) {
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      // Verificar se o método existe antes de chamar
      if (typeof this.socketService.getAllRoulettes !== 'function') {
        console.warn('[GlobalRouletteDataService] Método getAllRoulettes não encontrado no socketService');
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      const data = this.socketService.getAllRoulettes();
      
      // Validar os dados recebidos e atualizar cache apenas se válidos
      if (Array.isArray(data) && data.length > 0) {
        this.cachedData = data;
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[GlobalRouletteDataService] Erro em getAllDetailedRoulettes:', error);
      return this.cachedData.length > 0 ? this.cachedData : [];
    }
  }

  public getAllRoulettes(): RouletteData[] {
    try {
      if (!this.isServiceAvailable || !this.socketService) {
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      // Verificar se o método existe antes de chamar
      if (typeof this.socketService.getAllRoulettes !== 'function') {
        console.warn('[GlobalRouletteDataService] Método getAllRoulettes não encontrado no socketService');
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      const data = this.socketService.getAllRoulettes();
      
      // Validar os dados recebidos e atualizar cache apenas se válidos
      if (Array.isArray(data) && data.length > 0) {
        this.cachedData = data;
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[GlobalRouletteDataService] Erro em getAllRoulettes:', error);
      return this.cachedData.length > 0 ? this.cachedData : [];
    }
  }

  public getRouletteByName(rouletteName: string): RouletteData | null {
    try {
      if (!this.isServiceAvailable || !this.socketService || !rouletteName) {
        return null;
      }
      
      // Verificar se o método existe antes de chamar
      if (typeof this.socketService.getRouletteByName !== 'function') {
        console.warn('[GlobalRouletteDataService] Método getRouletteByName não encontrado no socketService');
        
        // Tentar buscar nos dados em cache
        const cachedRoulette = this.cachedData.find(r => 
          r.name === rouletteName || 
          r.id === rouletteName
        );
        
        return cachedRoulette || null;
      }
      
      return this.socketService.getRouletteByName(rouletteName);
    } catch (error) {
      console.error(`[GlobalRouletteDataService] Erro em getRouletteByName(${rouletteName}):`, error);
      
      // Tentar buscar nos dados em cache em caso de erro
      try {
        const cachedRoulette = this.cachedData.find(r => 
          r.name === rouletteName || 
          r.id === rouletteName
        );
        return cachedRoulette || null;
      } catch (cacheError) {
        return null;
      }
    }
  }

  public forceUpdate(): void {
    try {
      if (!this.isServiceAvailable || !this.socketService) {
        return;
      }
      
      // Verificar se o método existe antes de chamar
      if (typeof this.socketService.forceUpdate !== 'function') {
        console.warn('[GlobalRouletteDataService] Método forceUpdate não encontrado no socketService');
        return;
      }
      
      this.socketService.forceUpdate();
    } catch (error) {
      console.error('[GlobalRouletteDataService] Erro em forceUpdate:', error);
    }
  }

  public subscribe(id: string, callback: () => void): void {
    try {
      if (!this.isServiceAvailable || !this.socketService || !id || typeof callback !== 'function') {
        return;
      }
      
      // Verificar se o método existe antes de chamar
      if (typeof this.socketService.subscribe !== 'function') {
        console.warn('[GlobalRouletteDataService] Método subscribe não encontrado no socketService');
        return;
      }
      
      this.socketService.subscribe(id, callback);
    } catch (error) {
      console.error(`[GlobalRouletteDataService] Erro em subscribe(${id}):`, error);
    }
  }

  public unsubscribe(id: string): void {
    try {
      if (!this.isServiceAvailable || !this.socketService || !id) {
        return;
      }
      
      // Verificar se o método existe antes de chamar
      if (typeof this.socketService.unsubscribe !== 'function') {
        console.warn('[GlobalRouletteDataService] Método unsubscribe não encontrado no socketService');
        return;
      }
      
      this.socketService.unsubscribe(id);
    } catch (error) {
      console.error(`[GlobalRouletteDataService] Erro em unsubscribe(${id}):`, error);
    }
  }
}

// Exportar uma instância singleton
const instance = new GlobalRouletteDataService();
export default instance; 