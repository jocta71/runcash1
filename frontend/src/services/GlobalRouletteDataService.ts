/**
 * AVISO: Este é um serviço stub para compatibilidade.
 * O GlobalRouletteDataService foi removido e substituído pelo RESTSocketService.
 * Este arquivo existe apenas para manter a compatibilidade com componentes existentes.
 */

import RESTSocketService from './RESTSocketService';

class GlobalRouletteDataService {
  private socketService: any;
  private isServiceAvailable: boolean = false;
  private cachedData: any[] = [];
  private _isInitialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;

  constructor() {
    try {
      this.socketService = RESTSocketService.getInstance();
      this.isServiceAvailable = true;
      console.warn(
        'GlobalRouletteDataService está obsoleto e será removido em versões futuras. ' +
        'Use RESTSocketService diretamente.'
      );
      this._isInitialized = true;
    } catch (error) {
      console.error('Erro ao inicializar GlobalRouletteDataService stub:', error);
      this.isServiceAvailable = false;
      this._isInitialized = false;
    }
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

      try {
        this.socketService = RESTSocketService.getInstance();
        this.isServiceAvailable = true;
        this._isInitialized = true;
        resolve(true);
      } catch (error) {
        console.error('Erro ao inicializar GlobalRouletteDataService durante ensureInitialized:', error);
        this.isServiceAvailable = false;
        this._isInitialized = false;
        resolve(false);
      }
    });

    return this.initPromise;
  }

  // Métodos de compatibilidade que simplesmente encaminham para o RESTSocketService
  public async fetchDetailedRouletteData(): Promise<any[]> {
    try {
      await this.ensureInitialized();
      
      if (!this.isServiceAvailable) {
        console.warn('Service não disponível, retornando dados de cache ou array vazio');
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      const data = await this.socketService.fetchDetailedRouletteData();
      if (Array.isArray(data) && data.length > 0) {
        this.cachedData = data;
      }
      return data;
    } catch (error) {
      console.error('Erro em fetchDetailedRouletteData:', error);
      return this.cachedData.length > 0 ? this.cachedData : [];
    }
  }

  public getAllDetailedRoulettes(): any[] {
    try {
      if (!this.isServiceAvailable) {
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      const data = this.socketService.getAllRoulettes();
      if (Array.isArray(data) && data.length > 0) {
        this.cachedData = data;
      }
      return data;
    } catch (error) {
      console.error('Erro em getAllDetailedRoulettes:', error);
      return this.cachedData.length > 0 ? this.cachedData : [];
    }
  }

  public getAllRoulettes(): any[] {
    try {
      if (!this.isServiceAvailable) {
        return this.cachedData.length > 0 ? this.cachedData : [];
      }
      
      const data = this.socketService.getAllRoulettes();
      if (Array.isArray(data) && data.length > 0) {
        this.cachedData = data;
      }
      return data;
    } catch (error) {
      console.error('Erro em getAllRoulettes:', error);
      return this.cachedData.length > 0 ? this.cachedData : [];
    }
  }

  public getRouletteByName(rouletteName: string): any {
    try {
      if (!this.isServiceAvailable) {
        return null;
      }
      
      return this.socketService.getRouletteByName(rouletteName);
    } catch (error) {
      console.error(`Erro em getRouletteByName(${rouletteName}):`, error);
      return null;
    }
  }

  public forceUpdate(): void {
    try {
      if (!this.isServiceAvailable) {
        return;
      }
      
      this.socketService.forceUpdate();
    } catch (error) {
      console.error('Erro em forceUpdate:', error);
    }
  }

  public subscribe(id: string, callback: () => void): void {
    try {
      if (!this.isServiceAvailable) {
        return;
      }
      
      this.socketService.subscribe(id, callback);
    } catch (error) {
      console.error(`Erro em subscribe(${id}):`, error);
    }
  }

  public unsubscribe(id: string): void {
    try {
      if (!this.isServiceAvailable) {
        return;
      }
      
      this.socketService.unsubscribe(id);
    } catch (error) {
      console.error(`Erro em unsubscribe(${id}):`, error);
    }
  }
}

// Exportar uma instância singleton
const instance = new GlobalRouletteDataService();
export default instance; 