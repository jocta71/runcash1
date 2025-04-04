/**
 * Serviço para buscar dados em tempo real via polling como fallback
 * quando a conexão WebSocket falha
 */

import axios from 'axios';
import config from '@/config/env';
import EventService from './EventService';
import { RouletteNumberEvent } from './EventService';

// Configurações
const POLLING_INTERVAL = 5000; // 5 segundos entre cada verificação
const MAX_RETRIES = 3; // Número máximo de tentativas antes de desistir
const ALLOWED_ROULETTES = [
  "2010016",  // Immersive Roulette
  "2380335",  // Brazilian Mega Roulette
  "2010065",  // Bucharest Auto-Roulette
  "2010096",  // Speed Auto Roulette
  "2010017",  // Auto-Roulette
  "2010098"   // Auto-Roulette VIP
];

// Mapear nomes para IDs canônicos
const NAME_TO_ID_MAP: Record<string, string> = {
  "Immersive Roulette": "2010016",
  "Brazilian Mega Roulette": "2380335",
  "Bucharest Auto-Roulette": "2010065",
  "Speed Auto Roulette": "2010096",
  "Auto-Roulette": "2010017",
  "Auto-Roulette VIP": "2010098"
};

class FetchService {
  private static instance: FetchService;
  private pollingIntervalId: number | null = null;
  private lastFetchedNumbers: Map<string, { timestamp: number, numbers: number[] }> = new Map();
  private isPolling: boolean = false;
  private apiBaseUrl: string;
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    console.log('[FetchService] Inicializado com URL base:', this.apiBaseUrl);
  }
  
  public static getInstance(): FetchService {
    if (!FetchService.instance) {
      FetchService.instance = new FetchService();
    }
    return FetchService.instance;
  }
  
  /**
   * Inicia polling regular para buscar dados de roletas
   */
  public startPolling(): void {
    if (this.isPolling) {
      console.log('[FetchService] Polling já está em execução');
      return;
    }
    
    console.log('[FetchService] Iniciando polling regular de dados');
    this.isPolling = true;
    
    // Executar imediatamente a primeira vez
    this.fetchAllRouletteData();
    
    // Configurar intervalo para execuções periódicas
    this.pollingIntervalId = window.setInterval(() => {
      this.fetchAllRouletteData();
    }, POLLING_INTERVAL);
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
    console.log('[FetchService] Polling parado');
  }
  
  /**
   * Busca dados de todas as roletas permitidas
   */
  private async fetchAllRouletteData(): Promise<void> {
    console.log('[FetchService] Buscando dados das roletas...');
    
    try {
      // Primeira etapa: buscar todas as roletas para obter informações básicas
      const roulettes = await this.fetchAllRoulettes();
      
      if (!roulettes || roulettes.length === 0) {
        console.warn('[FetchService] Nenhuma roleta encontrada');
        return;
      }
      
      console.log(`[FetchService] Encontradas ${roulettes.length} roletas`);
      
      // Segunda etapa: para cada roleta, buscar os números mais recentes
      for (const roulette of roulettes) {
        try {
          // Ignorar roletas sem id
          if (!roulette.id) continue;
          
          // Buscar números para esta roleta
          const roletaId = this.getCanonicalId(roulette.id, roulette.nome);
          
          // Ignorar os Ids que não estão na lista de permitidos
          if (!ALLOWED_ROULETTES.includes(roletaId)) {
            continue;
          }
          
          console.log(`[FetchService] Buscando números para ${roulette.nome} (ID: ${roletaId})`);
          
          const numbers = await this.fetchRouletteNumbers(roletaId);
          
          if (numbers && numbers.length > 0) {
            // Verificar se são números que ainda não vimos
            this.processNewNumbers(roulette, numbers);
          }
        } catch (error) {
          console.error(`[FetchService] Erro ao buscar números para roleta ${roulette.nome}:`, error);
        }
      }
    } catch (error) {
      console.error('[FetchService] Erro ao buscar dados das roletas:', error);
    }
  }
  
  /**
   * Busca todas as roletas disponíveis
   */
  private async fetchAllRoulettes(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/roulettes`);
      
      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data;
      }
      
      throw new Error(`Resposta inválida ao buscar roletas: ${response.status}`);
    } catch (error) {
      console.error('[FetchService] Erro ao buscar lista de roletas:', error);
      return [];
    }
  }
  
  /**
   * Busca números para uma roleta específica
   */
  private async fetchRouletteNumbers(roletaId: string): Promise<number[]> {
    try {
      // Usar o endpoint único /api/ROULETTES e filtrar a roleta desejada
      try {
        const response = await axios.get(`${this.apiBaseUrl}/ROULETTES`);
        
        if (response.status === 200 && Array.isArray(response.data)) {
          // Encontrar a roleta específica pelo ID canônico
          const targetRoulette = response.data.find((roleta: any) => {
            const roletaCanonicalId = roleta.canonical_id || this.getCanonicalId(roleta.id || '', roleta.nome);
            return roletaCanonicalId === roletaId || roleta.id === roletaId;
          });
          
          if (targetRoulette && targetRoulette.numero && Array.isArray(targetRoulette.numero)) {
            // Extrair apenas os números numéricos do array de objetos
            return targetRoulette.numero.map((item: any) => {
              // Verificar se o item é um objeto com propriedade numero
              if (typeof item === 'object' && item !== null && 'numero' in item) {
                if (typeof item.numero === 'number' && !isNaN(item.numero)) {
                  return item.numero;
                } else if (typeof item.numero === 'string' && item.numero.trim() !== '') {
                  const parsedValue = parseInt(item.numero, 10);
                  if (!isNaN(parsedValue)) return parsedValue;
                }
              } 
              // Caso o item seja diretamente um número
              else if (typeof item === 'number' && !isNaN(item)) {
                return item;
              }
              
              // Se chegou aqui, é um valor inválido, retornar 0
              console.warn(`[FetchService] Valor inválido de número para ${roletaId}: ${JSON.stringify(item)}, usando 0`);
              return 0;
            });
          }
        }
      } catch (error) {
        console.warn(`[FetchService] Erro no endpoint principal para ${roletaId}, tentando fallback:`, error);
      }
      
      // Se falhar, tentar o endpoint de roletas legado (mais lento)
      const response = await axios.get(`${this.apiBaseUrl}/roulettes/${roletaId}`);
      
      if (response.status === 200 && response.data && Array.isArray(response.data.numeros)) {
        return response.data.numeros;
      }
      
      throw new Error(`Resposta inválida ao buscar números: ${response.status}`);
    } catch (error) {
      console.error(`[FetchService] Erro ao buscar números para roleta ${roletaId}:`, error);
      return [];
    }
  }
  
  /**
   * Processa números novos, comparando com os últimos recebidos
   */
  private processNewNumbers(roulette: any, numbers: number[]): void {
    if (!numbers || numbers.length === 0) return;
    
    const roletaId = this.getCanonicalId(roulette.id, roulette.nome);
    const roletaNome = roulette.nome;
    
    // Verificar se já temos números para esta roleta
    const lastData = this.lastFetchedNumbers.get(roletaId);
    
    if (!lastData) {
      // Primeiro conjunto de números para esta roleta
      console.log(`[FetchService] Primeiros números obtidos para ${roletaNome}: [${numbers.slice(0, 5).join(', ')}...]`);
      
      this.lastFetchedNumbers.set(roletaId, {
        timestamp: Date.now(),
        numbers: [...numbers]
      });
      
      // Emitir o número mais recente como evento
      const lastNumber = numbers[0];
      this.emitNumberEvent(roletaId, roletaNome, lastNumber);
      
      return;
    }
    
    // Verificar se temos números novos comparando com os últimos salvos
    const oldNumbers = lastData.numbers;
    const firstNewNumber = numbers[0];
    
    if (firstNewNumber !== oldNumbers[0]) {
      console.log(`[FetchService] Novo número detectado para ${roletaNome}: ${firstNewNumber} (anterior: ${oldNumbers[0]})`);
      
      // Atualizar a lista de números
      this.lastFetchedNumbers.set(roletaId, {
        timestamp: Date.now(),
        numbers: [...numbers]
      });
      
      // Emitir o novo número como evento
      this.emitNumberEvent(roletaId, roletaNome, firstNewNumber);
    } else {
      // Apenas atualizar o timestamp sem emitir evento
      console.log(`[FetchService] Nenhum número novo para ${roletaNome}, último: ${firstNewNumber}`);
      this.lastFetchedNumbers.set(roletaId, {
        timestamp: Date.now(),
        numbers: oldNumbers
      });
    }
  }
  
  /**
   * Emite um evento com o novo número para o sistema
   */
  private emitNumberEvent(roletaId: string, roletaNome: string, numero: number): void {
    // Verificar se o número é válido
    if (numero === undefined || numero === null || isNaN(numero)) {
      console.warn(`[FetchService] Tentativa de emitir número inválido para ${roletaNome}: ${numero}`);
      return;
    }
    
    // Criar o evento
    const event: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      numero: numero,
      timestamp: new Date().toISOString(),
      // Adicionar flag para indicar que este evento NÃO deve substituir dados existentes
      preserve_existing: true
    };
    
    console.log(`[FetchService] Emitindo evento de novo número para ${roletaNome}: ${numero}`);
    
    // Emitir utilizando o EventService
    const eventService = EventService.getInstance();
    
    // Tentar todas as formas possíveis de emitir o evento
    if (typeof eventService.dispatchEvent === 'function') {
      eventService.dispatchEvent(event);
    }
    
    EventService.emitGlobalEvent('new_number', event);
  }
  
  /**
   * Obtém o ID canônico para uma roleta, usando o nome como fallback
   */
  private getCanonicalId(id: string, nome?: string): string {
    // Se o ID já é canônico, retorná-lo
    if (ALLOWED_ROULETTES.includes(id)) {
      return id;
    }
    
    // Tentar mapear pelo nome
    if (nome && NAME_TO_ID_MAP[nome]) {
      return NAME_TO_ID_MAP[nome];
    }
    
    // Retornar o ID original como último recurso
    return id;
  }
  
  /**
   * Força uma atualização única das roletas
   */
  public forceUpdate(): void {
    console.log('[FetchService] Forçando atualização imediata das roletas');
    this.fetchAllRouletteData();
  }
}

export default FetchService; 