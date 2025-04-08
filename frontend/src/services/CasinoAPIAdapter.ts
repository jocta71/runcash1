import axios from 'axios';
import config from '@/config/env';
import { Logger } from './utils/logger';
import EventService from './EventService';

const logger = new Logger('CasinoAPIAdapter');

// URLs do 888casino
const CASINO_888_LIVE_TABLES_URL = 'https://cgp.safe-iplay.com/cgpapi/riverFeed/GetLiveTables';
const CASINO_888_JACKPOT_URL = 'https://casino-orbit-feeds-cdn.888casino.com/api/jackpotFeeds/v1/BRL';

// Intervalo de polling do 888casino
const CASINO_888_POLLING_INTERVAL = 11000; // 11 segundos

// Interface para mesas de roleta do 888casino
interface Casino888Table {
  GameID: string;
  Name: string;
  Dealer: string;
  IsOpen: boolean;
  Players: number;
  GameType: string;
  numbers?: string[]; // Adicionado por nós para rastrear os números
  Limits?: any[];
}

class CasinoAPIAdapter {
  private static instance: CasinoAPIAdapter;
  private isInitialized: boolean = false;
  private casino888Enabled: boolean = false;
  private pollingInterval: number | null = null;
  private lastRouletteNumbers: Map<string, string[]> = new Map();
  private casinoTables: { [id: string]: Casino888Table } = {};
  
  private constructor() {
    // Privado para implementar Singleton
  }
  
  public static getInstance(): CasinoAPIAdapter {
    if (!CasinoAPIAdapter.instance) {
      CasinoAPIAdapter.instance = new CasinoAPIAdapter();
    }
    return CasinoAPIAdapter.instance;
  }
  
  /**
   * Inicializa o adaptador com configurações específicas
   */
  public initialize(options: { enable888Casino?: boolean } = {}): void {
    if (this.isInitialized) return;
    
    this.casino888Enabled = options.enable888Casino || false;
    this.isInitialized = true;
    
    logger.info('CasinoAPIAdapter inicializado', { casino888Enabled: this.casino888Enabled });
    
    // Se o 888casino estiver habilitado, iniciar polling
    if (this.casino888Enabled) {
      this.startCasino888Polling();
    }
  }
  
  /**
   * Inicia o polling para o 888casino
   */
  public startCasino888Polling(): void {
    if (!this.casino888Enabled) {
      logger.warn('Tentativa de iniciar polling do 888casino, mas não está habilitado');
      return;
    }
    
    // Parar qualquer polling existente
    this.stopCasino888Polling();
    
    // Fazer primeira consulta imediatamente
    this.fetchCasino888Data();
    
    // Configurar polling no intervalo exato usado pelo 888casino
    this.pollingInterval = setInterval(() => {
      this.fetchCasino888Data();
    }, CASINO_888_POLLING_INTERVAL);
    
    logger.info(`Polling do 888casino iniciado (intervalo: ${CASINO_888_POLLING_INTERVAL}ms)`);
  }
  
  /**
   * Para o polling do 888casino
   */
  public stopCasino888Polling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('Polling do 888casino interrompido');
    }
  }
  
  /**
   * Busca dados do 888casino
   */
  private async fetchCasino888Data(): Promise<void> {
    try {
      // 1. Buscar dados de jackpots primeiro (como faz o 888casino)
      try {
        await axios.get(CASINO_888_JACKPOT_URL);
      } catch (error) {
        logger.warn('Erro ao buscar dados de jackpot do 888casino:', error);
        // Continuar mesmo se falhar
      }
      
      // 2. Buscar dados das mesas de roleta (prioridade principal)
      const formData = new URLSearchParams({
        'regulationID': '4',
        'lang': 'spa',
        'clientProperties': JSON.stringify({
          "version": "CGP-0-0-88-SPA-4.2436.5,0,4.2436.5-NC1",
          "brandName": "888Casino",
          "subBrandId": 0,
          "brandId": 0,
          "screenWidth": window.innerWidth || 1920,
          "screenHeight": window.innerHeight || 1080,
          "language": "spa",
          "operatingSystem": "windows"
        }),
        'CGP_DomainOrigin': 'https://es.888casino.com',
        'CGP_Skin': '888casino',
        'CGP_SkinOverride': 'com',
        'CGP_Country': 'BRA',
        'CGP_UseCountryAsState': 'false'
      });
      
      const response = await axios.post(CASINO_888_LIVE_TABLES_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://es.888casino.com',
          'Accept': '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site'
        }
      });
      
      // Processar dados recebidos
      if (response.data && response.data.LiveTables) {
        this.processCasino888Tables(response.data.LiveTables);
      }
    } catch (error) {
      logger.error('Erro ao buscar dados do 888casino:', error);
    }
  }
  
  /**
   * Processa as mesas recebidas do 888casino
   */
  private processCasino888Tables(liveTables: { [id: string]: Casino888Table }): void {
    // Atualizar o estado atual das mesas
    this.casinoTables = { ...liveTables };
    
    // Detectar mesas de roleta e processar os números
    Object.entries(liveTables).forEach(([tableId, tableInfo]) => {
      // Verificar se é uma mesa de roleta pelo nome
      const isRoulette = tableInfo.Name && (
        tableInfo.Name.toLowerCase().includes('roulette') || 
        tableInfo.Name.toLowerCase().includes('ruleta') ||
        tableInfo.GameType === 'roulette'
      );
      
      if (isRoulette) {
        // Aqui precisamos extrair os números da roleta da resposta
        // Como não vimos a estrutura exata no código do 888casino,
        // estamos tentando uma abordagem genérica
        const numbers = this.extractRouletteNumbers(tableInfo);
        
        if (numbers && numbers.length > 0) {
          // Verificar números anteriores
          const previousNumbers = this.lastRouletteNumbers.get(tableId) || [];
          
          // Verificar se há novos números (usando a mesma lógica do 888casino)
          if (previousNumbers.length === 0 || numbers[0] !== previousNumbers[0]) {
            logger.info(`Nova atualização para roleta 888casino ${tableInfo.Name}: ${numbers[0]}`);
            
            // Atualizar estado interno
            this.lastRouletteNumbers.set(tableId, [...numbers]);
            
            // Emitir evento de novo número
            EventService.emit('casino888:new-number', {
              tableId,
              tableName: tableInfo.Name,
              dealer: tableInfo.Dealer,
              newNumber: numbers[0],
              allNumbers: numbers,
              isOpen: tableInfo.IsOpen,
              timestamp: Date.now()
            });
          }
        }
      }
    });
    
    // Emitir evento com todas as mesas atualizadas
    EventService.emit('casino888:tables-updated', {
      tables: this.getCasino888Roulettes()
    });
  }
  
  /**
   * Extrai números de roleta dos dados da mesa
   * Nota: Implementação genérica, pode precisar ser ajustada quando soubermos a estrutura exata
   */
  private extractRouletteNumbers(tableInfo: Casino888Table): string[] {
    // Tenta vários caminhos possíveis onde os números podem estar
    if (tableInfo.numbers) return tableInfo.numbers;
    
    // Se não encontramos os números, tentamos extrair do histórico de jogos
    // (estrutura hipotética, precisa ser ajustada quando soubermos a estrutura real)
    if (tableInfo['GameHistory'] && Array.isArray(tableInfo['GameHistory'])) {
      return tableInfo['GameHistory'].map(game => game.number || game.Number || '').filter(n => n);
    }
    
    // Outras tentativas possíveis
    if (tableInfo['History'] && Array.isArray(tableInfo['History'])) {
      return tableInfo['History'];
    }
    
    if (tableInfo['RouletteNumbers'] && Array.isArray(tableInfo['RouletteNumbers'])) {
      return tableInfo['RouletteNumbers'];
    }
    
    // Fallback: array vazio
    return [];
  }
  
  /**
   * Retorna todas as roletas do 888casino
   */
  public getCasino888Roulettes(): { tableId: string, name: string, numbers: string[], dealer: string, isOpen: boolean }[] {
    const result: { tableId: string, name: string, numbers: string[], dealer: string, isOpen: boolean }[] = [];
    
    Object.entries(this.casinoTables).forEach(([tableId, tableInfo]) => {
      // Verificar se é uma mesa de roleta
      const isRoulette = tableInfo.Name && (
        tableInfo.Name.toLowerCase().includes('roulette') || 
        tableInfo.Name.toLowerCase().includes('ruleta') ||
        tableInfo.GameType === 'roulette'
      );
      
      if (isRoulette) {
        result.push({
          tableId,
          name: tableInfo.Name,
          numbers: this.lastRouletteNumbers.get(tableId) || [],
          dealer: tableInfo.Dealer,
          isOpen: tableInfo.IsOpen
        });
      }
    });
    
    return result;
  }
  
  /**
   * Verifica se o polling do 888casino está ativo
   */
  public isCasino888PollingActive(): boolean {
    return this.casino888Enabled && this.pollingInterval !== null;
  }
  
  /**
   * Obtém todos os números conhecidos para uma mesa específica
   */
  public getCasino888RouletteNumbers(tableId: string): string[] {
    return this.lastRouletteNumbers.get(tableId) || [];
  }
}

export default CasinoAPIAdapter; 