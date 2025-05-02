/**
 * AVISO: Este é um serviço stub para compatibilidade.
 * O GlobalRouletteDataService foi removido e substituído pelo RESTSocketService.
 * Este arquivo existe apenas para manter a compatibilidade com componentes existentes.
 */

import RESTSocketService from './RESTSocketService';

class GlobalRouletteDataService {
  private socketService: any;

  constructor() {
    this.socketService = RESTSocketService.getInstance();
    console.warn(
      'GlobalRouletteDataService está obsoleto e será removido em versões futuras. ' +
      'Use RESTSocketService diretamente.'
    );
  }

  // Métodos de compatibilidade que simplesmente encaminham para o RESTSocketService
  public async fetchDetailedRouletteData(): Promise<any[]> {
    return this.socketService.fetchDetailedRouletteData();
  }

  public getAllDetailedRoulettes(): any[] {
    return this.socketService.getAllRoulettes();
  }

  public getAllRoulettes(): any[] {
    return this.socketService.getAllRoulettes();
  }

  public getRouletteByName(rouletteName: string): any {
    return this.socketService.getRouletteByName(rouletteName);
  }

  public forceUpdate(): void {
    this.socketService.forceUpdate();
  }

  public subscribe(id: string, callback: () => void): void {
    this.socketService.subscribe(id, callback);
  }

  public unsubscribe(id: string): void {
    this.socketService.unsubscribe(id);
  }
}

// Exportar uma instância singleton
const instance = new GlobalRouletteDataService();
export default instance; 