import axios from 'axios';
import * as NodeJS from 'node:globals';
import config from '@/config/env';
import EventService from './EventService';
import { Logger } from './utils/logger';
import { HistoryData } from './SocketService';

const logger = new Logger('RouletteFeedService');

export interface RouletteTable {
  id: string;
  name: string;
  dealer: string;
  lastNumbers: number[];
  isOpen: boolean;
}

class RouletteFeedService {
  private static instance: RouletteFeedService;
  private apiBaseUrl: string;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  private socketService: any;
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingActive: boolean = false;
  private tables: RouletteTable[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  
  // URLs do 888casino
  private readonly liveTablesUrl: string = 'https://cgp.safe-iplay.com/cgpapi/riverFeed/GetLiveTables';
  private readonly jackpotFeedsUrl: string = 'https://casino-orbit-feeds-cdn.888casino.com/api/jackpotFeeds/0/BRL';
  private use888Casino: boolean = false; // Flag para controlar se usa 888casino ou API local
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    console.log('[RouletteFeedService] Inicializado com URL base:', this.apiBaseUrl);
  }
  
  public static getInstance(): RouletteFeedService {
    if (!RouletteFeedService.instance) {
      RouletteFeedService.instance = new RouletteFeedService();
    }
    return RouletteFeedService.instance;
  }
  
  /**
   * Inicia o serviço de feed de roletas
   */
  public start(use888Casino: boolean = false): void {
    console.log('[RouletteFeedService] Iniciando serviço de feed de roletas');
    this.use888Casino = use888Casino;
    
    // Buscar dados iniciais
    this.fetchInitialData();
    
    // Configurar polling em vez de SSE
    this.startPolling();
  }
  
  /**
   * Para o serviço de feed
   */
  public stop(): void {
    console.log('[RouletteFeedService] Parando serviço de feed de roletas');
    // Parar o polling
    this.stopPolling();
  }
  
  /**
   * Inicia o polling para buscar atualizações periódicas
   */
  public startPolling(intervalMs: number = 10000): void {
    if (this.pollingActive) {
      return;
    }

    this.pollingActive = true;
    this.pollingInterval = setInterval(() => {
      this.updateTables();
    }, intervalMs);

    // Busca inicial
    this.fetchRouletteTables();
  }
  
  /**
   * Para o polling
   */
  public stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.pollingActive = false;
  }
  
  /**
   * Busca dados iniciais das roletas
   */
  private async fetchInitialData(): Promise<void> {
    try {
      if (this.use888Casino) {
        await this.fetch888CasinoData();
      } else {
        const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
        
        if (response.status === 200 && response.data) {
          response.data.forEach((roleta: any) => {
            if (roleta.id && roleta.numeros) {
              this.lastRouletteNumbers.set(roleta.id, roleta.numeros);
            }
          });
        }
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar dados iniciais:', error);
    }
  }
  
  /**
   * Busca as atualizações mais recentes
   */
  private async fetchLatestData(): Promise<void> {
    try {
      if (this.use888Casino) {
        await this.fetch888CasinoData();
      } else {
        const response = await axios.get(`${this.apiBaseUrl}/api/roletas`);
        
        if (response.status === 200 && response.data) {
          let hasUpdates = false;
          
          response.data.forEach((roleta: any) => {
            if (roleta.id && roleta.numeros) {
              // Comparar com os últimos números armazenados
              const currentNumbers = this.lastRouletteNumbers.get(roleta.id) || [];
              const newNumbers = roleta.numeros;
              
              // Verificar se houve atualização (número diferente na primeira posição)
              if (newNumbers.length > 0 && 
                  (currentNumbers.length === 0 || newNumbers[0] !== currentNumbers[0])) {
                
                // Atualizar números armazenados
                this.lastRouletteNumbers.set(roleta.id, newNumbers);
                
                // Emitir evento de atualização
                EventService.emit('roulette:numbers-updated', {
                  tableId: roleta.id,
                  numbers: newNumbers,
                  isNewNumber: true
                });
                
                hasUpdates = true;
              }
            }
          });
          
          if (hasUpdates) {
            console.log('[RouletteFeedService] Atualizações recebidas via polling');
          }
        }
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar atualizações:', error);
    }
  }
  
  /**
   * Busca dados diretamente do 888casino
   */
  private async fetch888CasinoData(): Promise<void> {
    try {
      // 1. Buscar dados de jackpots (opcional)
      try {
        await axios.get(this.jackpotFeedsUrl);
      } catch (err) {
        console.warn('[RouletteFeedService] Erro ao buscar jackpots (não crítico):', err);
      }
      
      // 2. Buscar dados das mesas de roleta (principal)
      const formData = new URLSearchParams({
        'regulationID': '4',
        'lang': 'spa',
        'clientProperties': JSON.stringify({
          "version": "CGP-0-0-88-SPA-4.2436.5,0,4.2436.5-NC1",
          "brandName": "888Casino",
          "subBrandId": 0,
          "brandId": 0,
          "screenWidth": window.innerWidth,
          "screenHeight": window.innerHeight,
          "language": "spa",
          "operatingSystem": "windows"
        }),
        'CGP_DomainOrigin': 'https://es.888casino.com',
        'CGP_Skin': '888casino',
        'CGP_SkinOverride': 'com',
        'CGP_Country': 'BRA',
        'CGP_UseCountryAsState': 'false'
      });
      
      // Usar backend proxy para evitar CORS
      const response = await axios.post(`${this.apiBaseUrl}/api/proxy/888casino`, 
        formData.toString(),
        { 
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (response.status === 200 && response.data && response.data.LiveTables) {
        let hasUpdates = false;
        
        // Processar as mesas recebidas
        Object.entries(response.data.LiveTables).forEach(([tableId, tableInfo]: [string, any]) => {
          // Verificar se é uma mesa de roleta pelo nome
          const isRoulette = tableInfo.Name && 
                           (tableInfo.Name.toLowerCase().includes('roulette') || 
                            tableInfo.Name.toLowerCase().includes('ruleta'));
          
          if (isRoulette) {
            // Neste exemplo estamos usando o GameID como número mais recente
            // Na implementação real, você precisaria extrair os números corretos
            const latestNumbers = this.extractRouletteNumbers(tableInfo);
            
            if (latestNumbers && latestNumbers.length > 0) {
              // Obter estado anterior
              const previousNumbers = this.lastRouletteNumbers.get(tableId) || [];
              
              // Se não há números anteriores ou o primeiro número mudou
              if (previousNumbers.length === 0 || latestNumbers[0] !== previousNumbers[0]) {
                console.log(`[RouletteFeedService] Nova atualização para roleta ${tableInfo.Name}: ${latestNumbers[0]}`);
                
                // Atualizar estado
                this.lastRouletteNumbers.set(tableId, [...latestNumbers]);
                
                // Emitir evento
                EventService.emit('roulette:numbers-updated', {
                  tableId,
                  tableName: tableInfo.Name,
                  dealer: tableInfo.Dealer,
                  numbers: latestNumbers,
                  isNewNumber: true
                });
                
                hasUpdates = true;
              }
            }
          }
        });
        
        if (hasUpdates) {
          console.log('[RouletteFeedService] Atualizações recebidas do 888casino');
        }
      }
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao buscar dados do 888casino:', error);
    }
  }
  
  /**
   * Extrai números da roleta dos dados da mesa
   * Este método precisa ser adaptado conforme a estrutura real dos dados
   */
  private extractRouletteNumbers(tableInfo: any): string[] {
    // Implementação de exemplo - adaptação necessária
    // No 888casino, os números podem estar em diferentes locais
    if (tableInfo.numbers) return tableInfo.numbers;
    if (tableInfo.Numbers) return tableInfo.Numbers;
    if (tableInfo.gameData && tableInfo.gameData.numbers) return tableInfo.gameData.numbers;
    if (tableInfo.GameData && tableInfo.GameData.Numbers) return tableInfo.GameData.Numbers;
    
    // Se não encontrar, criar um array com valores aleatórios para teste
    // Em produção, você deve remover esta parte e retornar um array vazio
    return [Math.floor(Math.random() * 37).toString()];
  }
  
  /**
   * Retorna os últimos números conhecidos para uma mesa específica
   */
  public getLastNumbersForTable(tableId: string): string[] {
    return this.lastRouletteNumbers.get(tableId) || [];
  }
  
  /**
   * Retorna todas as mesas de roleta conhecidas
   */
  public getAllRouletteTables(): { tableId: string, tableName?: string, numbers: string[] }[] {
    const result: { tableId: string, tableName?: string, numbers: string[] }[] = [];
    
    this.lastRouletteNumbers.forEach((numbers, tableId) => {
      result.push({
        tableId,
        numbers
      });
    });
    
    return result;
  }

  /**
   * Obtém o histórico completo de números para uma roleta específica
   */
  async getCompleteHistory(roletaId: string): Promise<HistoryData> {
    try {
      console.log(`[RouletteFeedService] Solicitando histórico completo para roleta ${roletaId}`);
      
      if (!this.socketService) {
        throw new Error('SocketService não está inicializado');
      }
      
      const historyData = await this.socketService.requestRouletteHistory(roletaId);
      
      console.log(`[RouletteFeedService] Histórico recebido: ${historyData.numeros?.length || 0} números`);
      
      // Notificar via EventService
      EventService.emit('roulette:complete-history', {
        roletaId,
        history: historyData
      });
      
      return historyData;
    } catch (error) {
      console.error('[RouletteFeedService] Erro ao obter histórico:', error);
      throw error;
    }
  }

  public async fetchRouletteTables(): Promise<RouletteTable[]> {
    try {
      // Simula uma chamada à API do 888casino
      // Em produção, isso seria substituído por uma chamada real à API
      const mockData: RouletteTable[] = [
        {
          id: "lightning-roulette",
          name: "Lightning Roulette",
          dealer: "Maria Silva",
          lastNumbers: [12, 35, 0, 32, 15],
          isOpen: true
        },
        {
          id: "classic-roulette",
          name: "Classic Roulette",
          dealer: "João Pereira",
          lastNumbers: [7, 11, 23, 14, 9],
          isOpen: true
        },
        {
          id: "speed-roulette",
          name: "Speed Roulette",
          dealer: "Ana Costa",
          lastNumbers: [0, 26, 35, 4, 17],
          isOpen: true
        },
        {
          id: "vip-roulette",
          name: "VIP Roulette",
          dealer: "Carlos Oliveira",
          lastNumbers: [32, 19, 21, 36, 5],
          isOpen: false
        }
      ];

      this.tables = mockData;
      this.notifyListeners('update', this.tables);
      return this.tables;
    } catch (error) {
      console.error('Erro ao buscar dados das roletas:', error);
      return [];
    }
  }

  private async updateTables(): Promise<void> {
    try {
      const tables = await this.fetchRouletteTables();
      
      // Simular atualizações aleatórias nos números
      const updatedTables = tables.map(table => {
        // Apenas para simulação, adicionando um novo número aleatório a cada atualização
        const newNumber = Math.floor(Math.random() * 37); // 0-36
        const updatedNumbers = [newNumber, ...table.lastNumbers.slice(0, 4)];
        
        return {
          ...table,
          lastNumbers: updatedNumbers
        };
      });

      this.tables = updatedTables;
      this.notifyListeners('update', updatedTables);
    } catch (error) {
      console.error('Erro ao atualizar roletas:', error);
      throw error;
    }
  }

  public getTables(): RouletteTable[] {
    return [...this.tables];
  }

  // Obtém uma tabela específica pelo ID
  public getTableById(id: string): RouletteTable | undefined {
    return this.tables.find(table => table.id === id);
  }

  // Registra um listener para eventos
  public addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  // Remove um listener
  public removeEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      return;
    }
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      this.eventListeners.set(
        event,
        listeners.filter(listener => listener !== callback)
      );
    }
  }

  // Notifica os listeners de um evento
  private notifyListeners(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Erro em callback de evento:', error);
        }
      });
    }
  }
}

export default RouletteFeedService.getInstance(); 