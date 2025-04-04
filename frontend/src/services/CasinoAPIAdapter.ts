import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';

// Tipo para configuração do adaptador
interface CasinoAPIConfig {
  baseUrl: string;
  endpoint: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  pollInterval: number;
}

// Função para gerar ID de requisição único
function generateClientRequestId(): string {
  // Formato observado no site: mix de caracteres hexadecimais
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  // Inserir hífens para corresponder ao formato observado
  return `${result.substring(0, 8)}-${result.substring(8, 12)}-${result.substring(12, 16)}-${result.substring(16, 20)}-${result.substring(20)}`;
}

class CasinoAPIAdapter {
  private static instance: CasinoAPIAdapter;
  private config: CasinoAPIConfig;
  private pollingIntervalId: number | null = null;
  private isPolling: boolean = false;
  private lastData: any = null;
  
  constructor() {
    // Configuração padrão que corresponde ao site de referência
    this.config = {
      baseUrl: 'https://cgp.safe-iplay.com',
      endpoint: '/cgpapi/liveFeed/GetLiveTables',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      pollInterval: 5000 // 5 segundos, como observado no site
    };
    
    console.log('[CasinoAPIAdapter] Inicializado');
  }
  
  public static getInstance(): CasinoAPIAdapter {
    if (!CasinoAPIAdapter.instance) {
      CasinoAPIAdapter.instance = new CasinoAPIAdapter();
    }
    return CasinoAPIAdapter.instance;
  }
  
  /**
   * Configura o adaptador
   */
  public configure(config: Partial<CasinoAPIConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[CasinoAPIAdapter] Configuração atualizada:', this.config);
  }
  
  /**
   * Inicia o polling de dados
   */
  public startPolling(): void {
    if (this.isPolling) {
      console.log('[CasinoAPIAdapter] Polling já está em execução');
      return;
    }
    
    console.log('[CasinoAPIAdapter] Iniciando polling regular de dados');
    this.isPolling = true;
    
    // Executar imediatamente a primeira vez
    this.fetchLiveData();
    
    // Configurar intervalo para execuções periódicas
    this.pollingIntervalId = window.setInterval(() => {
      this.fetchLiveData();
    }, this.config.pollInterval);
  }
  
  /**
   * Para o polling de dados
   */
  public stopPolling(): void {
    if (this.pollingIntervalId !== null) {
      window.clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    this.isPolling = false;
    console.log('[CasinoAPIAdapter] Polling parado');
  }
  
  /**
   * Busca dados em tempo real da API
   */
  private async fetchLiveData(): Promise<void> {
    try {
      const url = `${this.config.baseUrl}${this.config.endpoint}`;
      
      // Gerar um clientRequestId para cada requisição
      const clientRequestId = generateClientRequestId();
      
      // Construir corpo da requisição exatamente como no site de referência
      const requestBody = `regulationID=48&lang=spa&clientRequestId=${clientRequestId}`;
      
      // Fazer requisição POST com os parâmetros exatos
      const response = await axios.post(url, requestBody, {
        headers: this.config.headers
      });
      
      if (response.status === 200 && response.data) {
        // Processar os dados recebidos
        this.processLiveData(response.data);
      } else {
        console.warn('[CasinoAPIAdapter] Resposta inválida:', response.status);
      }
    } catch (error) {
      console.error('[CasinoAPIAdapter] Erro ao buscar dados:', error);
    }
  }
  
  /**
   * Processa os dados recebidos da API
   */
  private processLiveData(data: any): void {
    // Verificar se temos dados de roletas (LiveTables)
    if (!data || !data.LiveTables) {
      console.warn('[CasinoAPIAdapter] Dados não contêm LiveTables');
      return;
    }
    
    const liveTables = data.LiveTables;
    
    // Verificar se a estrutura de dados mudou
    if (JSON.stringify(liveTables) === JSON.stringify(this.lastData)) {
      console.log('[CasinoAPIAdapter] Nenhuma alteração nos dados detectada');
      return;
    }
    
    // Atualizar último conjunto de dados
    this.lastData = liveTables;
    
    // Para cada mesa de roleta, processar e emitir evento
    Object.entries(liveTables).forEach(([tableId, tableData]: [string, any]) => {
      // Verificar se é uma mesa de roleta (pelo nome ou outras características)
      if (tableData && tableData.Name && 
          tableData.Name.toLowerCase().includes('roulette') && 
          tableData.RouletteLastNumbers && 
          Array.isArray(tableData.RouletteLastNumbers)) {
        
        // Formatar os dados para nosso padrão
        const formattedData = {
          tableId,
          tableName: tableData.Name,
          numbers: tableData.RouletteLastNumbers,
          dealer: tableData.Dealer,
          players: tableData.Players,
          isOpen: tableData.IsOpen
        };
        
        // Emitir evento com dados formatados
        EventService.emit('roulette:numbers-updated', formattedData);
        
        // Emitir evento específico para o primeiro número (mais recente)
        if (tableData.RouletteLastNumbers.length > 0) {
          EventService.emit('roulette:new-number', {
            tableId,
            tableName: tableData.Name,
            number: tableData.RouletteLastNumbers[0]
          });
        }
      }
    });
    
    // Emitir evento geral de atualização
    EventService.emit('casino:data-updated', data);
  }
  
  /**
   * Executa uma requisição única para a API
   */
  public async fetchDataOnce(): Promise<any> {
    try {
      const url = `${this.config.baseUrl}${this.config.endpoint}`;
      
      // Gerar um clientRequestId para a requisição
      const clientRequestId = generateClientRequestId();
      
      // Construir corpo da requisição exatamente como no site de referência
      const requestBody = `regulationID=48&lang=spa&clientRequestId=${clientRequestId}`;
      
      // Fazer requisição POST com os parâmetros exatos
      const response = await axios.post(url, requestBody, {
        headers: this.config.headers
      });
      
      if (response.status === 200) {
        this.processLiveData(response.data);
        return response.data;
      }
      
      throw new Error(`Resposta inválida: ${response.status}`);
    } catch (error) {
      console.error('[CasinoAPIAdapter] Erro ao buscar dados:', error);
      return null;
    }
  }
}

export default CasinoAPIAdapter; 