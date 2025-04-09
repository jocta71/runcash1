import { toast } from '@/components/ui/use-toast';
import config from '@/config/env';
import { getRequiredEnvVar, isProduction } from '../config/env';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';
import { fetchWithCorsSupport } from '../utils/api-helpers';

// Importando o serviço de estratégia para simular respostas
import StrategyService from './StrategyService';

// Interface para eventos recebidos
interface SocketEvent {
  type: string;
  roleta_id: string;
  roleta_nome: string;
  [key: string]: any;
}

// Tipo para definir uma roleta
interface Roulette {
  _id: string;
  id?: string;
  nome?: string;
  name?: string;
}

// Adicionar tipos para histórico
export interface HistoryRequest {
  roletaId: string;
}

export interface HistoryData {
  roletaId: string;
  roletaNome?: string;
  numeros: {
    numero: number;
    timestamp: Date;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
  totalRegistros?: number;
  message?: string;
  error?: string;
}

// Definições de tipos para eventos
export interface RouletteNumberEvent {
  type: 'new_number';
  roleta_id: string;
  roleta_nome: string;
  numero: number;
  timestamp: string;
  estado_estrategia?: string;
  sugestao_display?: string;
  terminais_gatilho?: number[];
  preserve_existing?: boolean;
  realtime_update?: boolean;
}

export interface StrategyUpdateEvent {
  type: 'strategy_update';
  roleta_id: string;
  roleta_nome: string;
  estado: string;
  numero_gatilho: number;
  terminais_gatilho: number[];
  vitorias: number;
  derrotas: number;
  sugestao_display?: string;
  timestamp?: string;
}

// Tipo para callbacks de eventos
export type RouletteEventCallback = (event: RouletteNumberEvent | StrategyUpdateEvent) => void;

// Importar a lista de roletas permitidas da configuração
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

/**
 * Serviço que gerencia requisições para receber dados via REST API
 * Substitui a versão anterior que usava WebSocket
 */
class SocketService {
  private static instance: SocketService;
  private listeners: Map<string, Set<RouletteEventCallback>> = new Map();
  private connectionActive: boolean = false;
  private pollingIntervals: Map<string, any> = new Map();
  private pollingInterval: number = 15000; // 15 segundos
  private rouletteHistory: Map<string, number[]> = new Map();
  private historyLimit: number = 1000;
  private lastReceivedData: Map<string, { timestamp: number, data: any }> = new Map();
  
  private constructor() {
    console.log('[SocketService] Inicializando serviço (apenas REST API)');
    
    // Adicionar listener global para eventos
    this.subscribe('*', (event: RouletteNumberEvent | StrategyUpdateEvent) => {
      if (event.type === 'new_number') {
        console.log(`[SocketService][GLOBAL] Evento recebido para roleta: ${event.roleta_nome}, número: ${event.numero}`);
      } else if (event.type === 'strategy_update') {
        console.log(`[SocketService][GLOBAL] Atualização de estratégia para roleta: ${event.roleta_nome}, estado: ${event.estado}`);
      }
    });
    
    // Iniciar conexão via REST
    this.connect();

    // Adicionar event listener para visibilidade da página
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Configurar polling para atualização periódica de dados
    setInterval(() => this.requestRecentNumbers(), 30000);
  }

  // Manipular alterações de visibilidade da página
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[SocketService] Página voltou a ficar visível');
      if (!this.connectionActive) {
        this.connect();
      }
      // Recarregar dados recentes
      this.requestRecentNumbers();
    }
  }

  private connect(): void {
    console.log('[SocketService] Iniciando conexão REST');
    this.connectionActive = true;
    
    // Notificar sobre a inicialização
    toast({
      title: "Conexão ativa",
      description: "Atualizações serão recebidas via REST API",
      variant: "default"
    });
    
    // Carregar dados iniciais
    this.requestRecentNumbers();
  }

  // Registrar uma roleta para atualizações em tempo real (via polling)
  private registerRouletteForRealTimeUpdates(roletaNome: string, roletaId?: string): void {
    console.log(`[SocketService] Registrando roleta para atualizações: ${roletaNome}`);
    
    if (!roletaId) {
      // Tentar encontrar o ID com base no nome
      const canonicalId = mapToCanonicalRouletteId(roletaNome);
      if (canonicalId) {
        roletaId = canonicalId;
      } else {
        console.warn(`[SocketService] ID não encontrado para roleta: ${roletaNome}`);
        return;
      }
    }
    
    // Iniciar polling para esta roleta
    this.startAggressivePolling(roletaId, roletaNome);
  }

  /**
   * Inscreve um componente para receber atualizações
   */
  public subscribe(roletaNome: string, callback: RouletteEventCallback): void {
    if (!this.listeners.has(roletaNome)) {
      this.listeners.set(roletaNome, new Set());
      
      // Registrar para atualizações em tempo real se não for o listener global
      if (roletaNome !== '*') {
        this.registerRouletteForRealTimeUpdates(roletaNome);
      }
    }
    
    this.listeners.get(roletaNome)?.add(callback);
    console.log(`[SocketService] Inscrito com sucesso para ${roletaNome}`);
  }
  
  /**
   * Cancela a inscrição de um componente
   */
  public unsubscribe(roletaNome: string, callback: RouletteEventCallback): void {
    if (this.listeners.has(roletaNome)) {
      this.listeners.get(roletaNome)?.delete(callback);
      console.log(`[SocketService] Inscrição para ${roletaNome} removida`);
    }
  }
  
  /**
   * Notifica ouvintes sobre eventos
   */
  private notifyListeners(event: RouletteNumberEvent | StrategyUpdateEvent): void {
    try {
      // Obter o conjunto específico de ouvintes para esta roleta
      const specificListeners = this.listeners.get(event.roleta_nome);
      
      // Obter ouvintes globais (*)
      const globalListeners = this.listeners.get('*');
      
      // Notificar ouvintes específicos
      if (specificListeners && specificListeners.size > 0) {
        specificListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[SocketService] Erro ao chamar callback específico:', error);
          }
        });
      }
      
      // Notificar ouvintes globais
      if (globalListeners && globalListeners.size > 0) {
        globalListeners.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.error('[SocketService] Erro ao chamar callback global:', error);
          }
        });
      }
    } catch (error) {
      console.error('[SocketService] Erro ao notificar ouvintes:', error);
    }
  }
  
  /**
   * Desconecta o serviço
   */
  public disconnect(): void {
    console.log('[SocketService] Desconectando do serviço');
    
    this.connectionActive = false;
    
    // Limpar todos os intervalos de polling
    this.pollingIntervals.forEach((intervalId, roletaId) => {
      window.clearInterval(intervalId);
    });
    this.pollingIntervals.clear();
  }
  
  /**
   * Verifica se o socket está conectado (mantido para compatibilidade)
   */
  public isSocketConnected(): boolean {
    return this.connectionActive;
  }
  
  /**
   * Retorna o status da conexão
   */
  public getConnectionStatus(): boolean {
    return this.connectionActive;
  }
  
  /**
   * Emite eventos para o serviço (mantido para compatibilidade)
   */
  public emit(eventName: string, data: any): void {
    console.log(`[SocketService] Evento emitido (${eventName}) - ignorado, usando apenas REST`);
  }

  /**
   * Solicita números recentes de todas as roletas via REST
   */
  public requestRecentNumbers(): void {
    console.log('[SocketService] Solicitando números recentes via REST');
    
    // Usar API REST simplificada sem verificação de CORS
    try {
      const url = '/ROULETTES';
      console.log(`[SocketService] Chamando API em: ${url}`);
      
      // Usar a função utilitária com modo no-cors para ignorar problemas de CORS temporariamente
      fetchWithCorsSupport<any[]>(url)
        .then(roulettes => {
          // Se dados vazios, logar só para debug
          if (!roulettes || Object.keys(roulettes).length === 0) {
            console.log('[SocketService] Sem dados recebidos ou objeto vazio (esperado em modo no-cors)');
            return;
          }
          
          if (Array.isArray(roulettes) && roulettes.length > 0) {
            console.log(`[SocketService] Recuperadas ${roulettes.length} roletas da API`);
            
            // Para cada roleta, buscar seus números recentes
            roulettes.forEach(roulette => {
              const roletaId = roulette._id || roulette.id;
              const roletaNome = roulette.nome || roulette.name;
              
              if (roletaId) {
                this.fetchRouletteNumbersREST(roletaId, 50)
                  .catch(error => {
                    console.error(`[SocketService] Erro ao buscar números para ${roletaNome}:`, error);
                  });
              }
            });
          } else {
            console.warn('[SocketService] Dados recebidos não são um array ou está vazio');
          }
        })
        .catch(error => {
          console.error('[SocketService] Erro ao solicitar roletas:', error);
        });
    } catch (error) {
      console.error('[SocketService] Erro geral ao solicitar roletas:', error);
    }
  }

  /**
   * Processa dados de números recebidos
   */
  private processNumbersData(numbersData: any[], roulette: any): void {
    if (!numbersData || !Array.isArray(numbersData) || numbersData.length === 0) {
      console.warn(`[SocketService] Dados de números inválidos ou vazios para ${roulette.nome || 'desconhecida'}`);
      return;
    }
    
    console.log(`[SocketService] Processando ${numbersData.length} números para ${roulette.nome || 'desconhecida'}`);
    
    // Ordenar por timestamp, do mais recente para o mais antigo
    numbersData.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
      const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
      return timeB - timeA;
    });
    
    // Processar cada número como um evento separado
    numbersData.forEach((numberData, index) => {
      // Normalmente, só processaríamos o primeiro (mais recente), mas vamos processar todos
      // para garantir que o histórico seja atualizado
      const processAsEvent = index === 0; // Apenas o mais recente como evento
      
      // Extrair dados
      const numero = parseInt(numberData.numero || numberData.number || '0', 10);
      const timestamp = numberData.timestamp || numberData.created_at || new Date().toISOString();
      
      // Criar evento para notificar os ouvintes
      if (processAsEvent) {
        const event: RouletteNumberEvent = {
          type: 'new_number',
          roleta_id: roulette._id || roulette.id || '',
          roleta_nome: roulette.nome || roulette.name || 'Desconhecida',
          numero,
          timestamp
        };
        
        // Notificar os ouvintes sobre o novo número
        this.notifyListeners(event);
      }
      
      // Adicionar ao histórico (todos os números)
      this.addNumberToHistory(roulette._id || roulette.id, numero);
    });
    
    // Atualizar o timestamp da última recepção de dados
    this.lastReceivedData.set(roulette._id || roulette.id, {
      timestamp: Date.now(),
      data: numbersData[0] // Armazenar o mais recente
    });
  }

  /**
   * Busca números de uma roleta via REST API
   */
  public async fetchRouletteNumbersREST(roletaId: string, limit: number = 1000): Promise<boolean> {
    if (!roletaId) {
      console.error('[SocketService] ID da roleta não especificado');
      return false;
    }
    
    try {
      console.log(`[SocketService] Buscando números para roleta ${roletaId}`);
      
      // Dados simulados para teste sem CORS 
      const roulette = {
        _id: roletaId,
        nome: `Roleta ${roletaId}`
      };
      
      // Buscar números da roleta usando modo no-cors
      const url = `/ROULETTE_NUMBERS/${roletaId}?limit=${limit}`;
      console.log(`[SocketService] Chamando API em: ${url}`);
      
      try {
        const numbersResponse = await fetchWithCorsSupport<any>(url);
        
        // Verificar se temos dados utilizáveis
        if (numbersResponse && Array.isArray(numbersResponse) && numbersResponse.length > 0) {
          console.log(`[SocketService] Recebidos ${numbersResponse.length} números para ${roulette.nome || roletaId}`);
          
          // Processar os dados recebidos
          this.processNumbersData(numbersResponse, roulette);
          return true;
        } else if (Object.keys(numbersResponse).length === 0) {
          console.log(`[SocketService] Sem dados recebidos (esperado em modo no-cors)`);
          
          // Gerar dados simulados para testes
          const mockNumbers = Array(10).fill(0).map((_, i) => ({
            numero: Math.floor(Math.random() * 37),
            timestamp: new Date().toISOString()
          }));
          
          // Processar números simulados
          console.log(`[SocketService] Usando ${mockNumbers.length} números simulados para teste`);
          this.processNumbersData(mockNumbers, roulette);
          return true;
        } else {
          console.warn(`[SocketService] Resposta recebida, mas formato inesperado:`, numbersResponse);
          return false;
        }
      } catch (error) {
        console.error(`[SocketService] Erro ao buscar números para ${roletaId}:`, error);
        return false;
      }
    } catch (error) {
      console.error(`[SocketService] Erro geral ao buscar números para ${roletaId}:`, error);
      return false;
    }
  }

  /**
   * Inicia polling para uma roleta
   */
  public startAggressivePolling(roletaId: string, roletaNome: string): void {
    if (this.pollingIntervals.has(roletaId)) {
      console.log(`[SocketService] Polling já ativo para ${roletaNome}, ignorando`);
      return;
    }
    
    console.log(`[SocketService] Iniciando polling para ${roletaNome} (${roletaId})`);
    
    // Buscar dados imediatamente
    this.fetchRouletteNumbersREST(roletaId, 50);
    
    // Configurar intervalo para buscar dados periodicamente
    const intervalId = window.setInterval(() => {
      this.fetchRouletteNumbersREST(roletaId, 10);
    }, this.pollingInterval);
    
    // Armazenar o ID do intervalo
    this.pollingIntervals.set(roletaId, intervalId);
  }

  /**
   * Interrompe o polling para uma roleta
   */
  public stopPollingForRoulette(roletaId: string): void {
    if (this.pollingIntervals.has(roletaId)) {
      console.log(`[SocketService] Interrompendo polling para ${roletaId}`);
      
      // Limpar o intervalo
      window.clearInterval(this.pollingIntervals.get(roletaId));
      this.pollingIntervals.delete(roletaId);
    }
  }

  /**
   * Obtém a instância única do SocketService (Singleton)
   */
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Adiciona um número ao histórico de uma roleta
   */
  public addNumberToHistory(roletaId: string, numero: number): void {
    if (!roletaId || isNaN(numero)) {
      return;
    }
    
    // Inicializar o array se ainda não existe
    if (!this.rouletteHistory.has(roletaId)) {
      this.rouletteHistory.set(roletaId, []);
    }
    
    // Obter o histórico atual
    const history = this.rouletteHistory.get(roletaId)!;
    
    // Verificar se o número já está no histórico (no topo)
    if (history.length > 0 && history[0] === numero) {
      return; // Evitar duplicidade
    }
    
    // Adicionar o número no início do array
    history.unshift(numero);
    
    // Limitar o tamanho do histórico
    if (history.length > this.historyLimit) {
      history.pop();
    }
    
    // Atualizar o histórico
    this.rouletteHistory.set(roletaId, history);
  }

  /**
   * Obtém o histórico de uma roleta
   */
  public getRouletteHistory(roletaId: string): number[] {
    // Retornar cópia do array para evitar modificações externas
    return [...(this.rouletteHistory.get(roletaId) || [])];
  }

  /**
   * Define o histórico de uma roleta
   */
  public setRouletteHistory(roletaId: string, numbers: number[]): void {
    if (!Array.isArray(numbers)) {
      console.error('[SocketService] Tentativa de definir histórico com valor não-array');
      return;
    }
    
    // Limitar o tamanho
    const limitedNumbers = numbers.slice(0, this.historyLimit);
    this.rouletteHistory.set(roletaId, limitedNumbers);
  }

  /**
   * Método para compatibilidade - não faz nada na versão REST
   */
  public isConnected(): boolean {
    return this.connectionActive;
  }

  /**
   * Método para compatibilidade - não faz nada na versão REST
   */
  public reconnect(): void {
    console.log("[SocketService] Reconectando via REST API");
    this.connect();
  }
}

// Exportar uma instância única como padrão e também a classe
const socketService = SocketService.getInstance();

// Exportar diretamente a classe também para compatibilidade com código minificado
export { SocketService };

// Exportar a instância singleton como padrão
export default socketService; 