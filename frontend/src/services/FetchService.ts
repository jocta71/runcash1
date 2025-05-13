/**
 * Serviço para buscar dados em tempo real via eventos SSE
 * (Polling foi removido para otimização)
 */

import EventService from './EventService';
import { RouletteNumberEvent } from './EventService';
import { RequestThrottler } from './utils/requestThrottler';
import { getLogger } from './utils/logger';
import config from '@/config/env';
import { ROLETAS_PERMITIDAS } from '@/config/allowedRoulettes';

const logger = getLogger('FetchService');

// Configurações
const MAX_RETRIES = 3; // Número máximo de tentativas antes de desistir
const ALLOWED_ROULETTES = ROLETAS_PERMITIDAS;

// Mapear nomes para IDs canônicos
const NAME_TO_ID_MAP: Record<string, string> = {
  "Immersive Roulette": "2010016",
  "Brazilian Mega Roulette": "2380335",
  "Bucharest Auto-Roulette": "2010065",
  "Speed Auto Roulette": "2010096",
  "Auto-Roulette": "2010017",
  "Auto-Roulette VIP": "2010098"
};

interface FetchOptions extends RequestInit {
  skipCache?: boolean;
  cacheTime?: number;
  throttleKey?: string;
  forceRefresh?: boolean;
}

class FetchService {
  private static instance: FetchService;
  private lastFetchedNumbers: Map<string, { timestamp: number, numbers: number[] }> = new Map();
  private apiBaseUrl: string;
  
  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
    logger.info('Inicializado com URL base:', this.apiBaseUrl);
  }
  
  public static getInstance(): FetchService {
    if (!FetchService.instance) {
      FetchService.instance = new FetchService();
    }
    return FetchService.instance;
  }
  
  /**
   * Método mantido para compatibilidade, mas implementado para não fazer nada
   * @deprecated Polling foi desativado para melhorar o desempenho
   */
  public startPolling(): void {
    logger.info('⚠️ Polling foi desativado para melhorar performance');
  }
  
  /**
   * Método mantido para compatibilidade, mas implementado para não fazer nada
   * @deprecated Polling foi desativado para melhorar o desempenho
   */
  public stopPolling(): void {
    logger.info('⚠️ Polling já está desativado');
  }
  
  /**
   * Busca dados de todas as roletas permitidas sob demanda
   */
  public async fetchAllRouletteData(): Promise<void> {
    logger.debug('Buscando dados das roletas (sob demanda)...');
    
    try {
      // Primeira etapa: buscar todas as roletas para obter informações básicas
      const roulettes = await this.fetchAllRoulettes();
      
      if (!roulettes || roulettes.length === 0) {
        logger.warn('Nenhuma roleta encontrada');
        return;
      }
      
      logger.debug(`Encontradas ${roulettes.length} roletas`);
      
      // Segunda etapa: para cada roleta, buscar os números mais recentes
      for (const roulette of roulettes) {
        try {
          // Ignorar roletas sem id
          if (!roulette || !roulette.id) continue;
          
          // Buscar números para esta roleta
          const roletaId = this.getCanonicalId(roulette.id, roulette.nome);
          
          // Ignorar os Ids que não estão na lista de permitidos
          if (!ALLOWED_ROULETTES.includes(roletaId)) {
            continue;
          }
          
          logger.debug(`Buscando números para ${roulette.nome || 'Roleta Desconhecida'} (ID: ${roletaId})`);
          
          const numbers = await this.fetchRouletteNumbers(roletaId);
          
          if (numbers && numbers.length > 0) {
            // Verificar se são números que ainda não vimos
            this.processNewNumbers(roulette, numbers);
          }
        } catch (error) {
          logger.error(`Erro ao buscar números para roleta ${roulette?.nome || 'desconhecida'}:`, error);
        }
      }
    } catch (error) {
      logger.error('Erro ao buscar dados das roletas:', error);
    }
  }
  
  /**
   * Busca todas as roletas disponíveis
   */
  private async fetchAllRoulettes(): Promise<any[]> {
    try {
      const response = await this.get<any[]>(`${this.apiBaseUrl}/roulettes`, {
        throttleKey: 'all_roulettes',
        forceRefresh: false
      });
      
      if (response && Array.isArray(response)) {
        return response;
      }
      
      throw new Error(`Resposta inválida ao buscar roletas`);
    } catch (error) {
      logger.error('Erro ao buscar lista de roletas:', error);
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
        const response = await this.get<any[]>(`${this.apiBaseUrl}/ROULETTES`, {
          throttleKey: 'all_roulettes_data',
          forceRefresh: false
        });
        
        if (response && Array.isArray(response)) {
          // Encontrar a roleta específica pelo ID canônico
          const targetRoulette = response.find((roleta: any) => {
            // Verificar se roleta existe e tem propriedades antes de acessá-las
            if (!roleta) return false;
            
            // Usar valores padrão seguros se as propriedades forem undefined
            const roletaId = roleta.id || '';
            const roletaNome = roleta.nome || '';
            
            const roletaCanonicalId = roleta.canonical_id || 
              this.getCanonicalId(roletaId, roletaNome);
            
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
              logger.warn(`Valor inválido de número para ${roletaId}: ${JSON.stringify(item)}, usando 0`);
              return 0;
            });
          }
        }
      } catch (error) {
        logger.warn(`Erro no endpoint principal para ${roletaId}, tentando fallback:`, error);
      }
      
      // Se falhar, tentar o endpoint de roletas legado (mais lento)
      const response = await this.get<any>(`${this.apiBaseUrl}/roulettes/${roletaId}`, {
        throttleKey: `roulette_${roletaId}`,
        forceRefresh: false
      });
      
      if (response && response.numeros && Array.isArray(response.numeros)) {
        return response.numeros;
      }
      
      throw new Error(`Resposta inválida ao buscar números para roleta ${roletaId}`);
    } catch (error) {
      logger.error(`Erro ao buscar números para roleta ${roletaId}:`, error);
      return [];
    }
  }
  
  /**
   * Processa números novos, comparando com os últimos recebidos
   */
  private processNewNumbers(roulette: any, numbers: number[]): void {
    // Verificar se temos dados válidos
    if (!roulette || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return;
    }
    
    // Garantir que temos um ID e nome válidos
    const roletaId = this.getCanonicalId(roulette.id, roulette.nome);
    const roletaNome = roulette.nome || 'Roleta Desconhecida';
    
    // Verificar se já temos números para esta roleta
    const lastData = this.lastFetchedNumbers.get(roletaId);
    
    if (!lastData) {
      // Primeiro conjunto de números para esta roleta
      logger.info(`Primeiros números obtidos para ${roletaNome}: [${numbers.slice(0, 5).join(', ')}...]`);
      
      this.lastFetchedNumbers.set(roletaId, {
        timestamp: Date.now(),
        numbers: numbers
      });
      
      // Não disparar evento se é o primeiro conjunto de números
      return;
    }
    
    // Verificar se há novos números
    const lastNumbers = lastData.numbers;
    const newNumbers = this.findNewNumbers(lastNumbers, numbers);
    
    if (newNumbers.length > 0) {
      logger.info(`${newNumbers.length} novos números para ${roletaNome}: [${newNumbers.join(', ')}]`);
      
      // Atualizar o registro de últimos números
      this.lastFetchedNumbers.set(roletaId, {
        timestamp: Date.now(),
        numbers: numbers
      });
      
      // Emitir evento para cada novo número, do mais antigo ao mais recente
      // para manter a ordem cronológica
      newNumbers.forEach(numero => {
        this.emitNumberEvent(roletaId, roletaNome, numero);
      });
    }
  }
  
  /**
   * Encontra números novos comparando dois arrays
   */
  private findNewNumbers(oldNumbers: number[], newNumbers: number[]): number[] {
    if (!oldNumbers || !Array.isArray(oldNumbers) || !newNumbers || !Array.isArray(newNumbers)) {
      return [];
    }
    
    const result: number[] = [];
    
    // Verificar quais números são novos
    // Considerar apenas os primeiros números de newNumbers que não estão em oldNumbers
    // respeitando a ordem e sem repetições
    
    let i = 0;
    while (i < newNumbers.length) {
      const numero = newNumbers[i];
      
      // Se o número atual já está no resultado, pular
      if (result.includes(numero)) {
        i++;
        continue;
      }
      
      // Se o número atual não está nos números antigos
      // e é o primeiro ou diferente do anterior, adicionar
      if (!oldNumbers.includes(numero) && 
          (result.length === 0 || numero !== result[result.length - 1])) {
        result.push(numero);
      }
      
      i++;
    }
    
    return result;
  }
  
  /**
   * Emite um evento de novo número via EventService
   */
  private emitNumberEvent(roletaId: string, roletaNome: string, numero: number): void {
    // Verificar se o número é válido
    if (numero === undefined || numero === null || isNaN(numero)) {
      logger.warn(`Tentativa de emitir evento com número inválido para ${roletaNome}: ${numero}`);
      return;
    }
    
    // Determinar a cor do número
    const cor = this.determinarCorNumero(numero);
    
    // Criar objeto de evento
    const event: RouletteNumberEvent = {
      type: 'new_number',
      roleta_id: roletaId,
      roleta_nome: roletaNome,
      numero: numero,
      timestamp: new Date().toISOString()
    };
    
    // Emitir evento
    const eventService = EventService.getInstance();
    eventService.dispatchEvent(event);
    logger.debug(`Evento emitido: Número ${numero} (${cor}) para ${roletaNome}`);
  }
  
  /**
   * Obtém o ID canônico para uma roleta
   */
  private getCanonicalId(id: string = '', nome?: string): string {
    // Primeiro verificar se temos um ID direto
    if (id && typeof id === 'string' && id.trim() !== '') {
      return id.trim();
    }
    
    // Se temos um nome, verificar se existe no mapeamento
    if (nome && typeof nome === 'string' && nome.trim() !== '') {
      const normalizedNome = nome.trim();
      
      if (normalizedNome in NAME_TO_ID_MAP) {
        return NAME_TO_ID_MAP[normalizedNome];
      }
    }
    
    // Fallback para ID desconhecido com timestamp
    return `unknown_${Date.now()}`;
  }
  
  /**
   * Força uma atualização imediata
   */
  public forceUpdate(): void {
    this.fetchAllRouletteData();
  }
  
  /**
   * Realiza uma requisição GET
   */
  async get<T>(url: string, options: FetchOptions = {}): Promise<T | null> {
    try {
      const response = await this.fetchData<T>(url, {
        method: 'GET',
        ...options
      });
      
      return response;
    } catch (error) {
      logger.error(`Erro na requisição GET para ${url}:`, error);
      return null;
    }
  }
  
  /**
   * Realiza uma requisição POST
   */
  async post<T>(url: string, data: any, options: FetchOptions = {}): Promise<T | null> {
    try {
      const response = await this.fetchData<T>(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: JSON.stringify(data),
        ...options
      });
      
      return response;
    } catch (error) {
      logger.error(`Erro na requisição POST para ${url}:`, error);
      return null;
    }
  }
  
  /**
   * Limpa o cache para uma URL específica
   */
  clearCache(url: string): void {
    RequestThrottler.clearCache(url);
  }
  
  /**
   * Limpa todo o cache
   */
  clearAllCache(): void {
    RequestThrottler.clearCache();
  }
  
  /**
   * Método base para realizar requisições com controle de cache e throttling
   */
  public async fetchData<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Extrair opções adicionais de FetchOptions
    const fetchOptions = options as FetchOptions;
    const skipCache = fetchOptions?.skipCache || false;
    const cacheTime = fetchOptions?.cacheTime || 10000; // 10 segundos padrão
    const throttleKey = fetchOptions?.throttleKey || endpoint;
    const forceRefresh = fetchOptions?.forceRefresh || false;
    
    // Criar novas options sem nossas opções customizadas
    const requestOptions: RequestInit = { ...options };
    delete (requestOptions as any).skipCache;
    delete (requestOptions as any).cacheTime;
    delete (requestOptions as any).throttleKey;
    delete (requestOptions as any).forceRefresh;
    
    // Usar o ThrottleRequest para gerenciar requisições
    try {
      const response = await RequestThrottler.scheduleRequest<T>(
        throttleKey,
        async () => {
          const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(requestOptions?.headers || {})
          };
          
          const response = await fetch(endpoint, {
            ...requestOptions,
            headers
          });
          
          if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
          }
          
          return await response.json();
        },
        forceRefresh,
        skipCache,
        cacheTime
      );
      
      return response;
    } catch (error) {
      logger.error(`Erro ao buscar dados de ${endpoint}:`, error);
      throw error;
    }
  }
  
  /**
   * Processa dados brutos de uma roleta para um formato padronizado
   */
  private processRouletteData(roulette: any): any {
    if (!roulette) return null;
    
    // Garantir ID e nome
    const id = roulette.id || `unknown_${Date.now()}`;
    const nome = roulette.nome || roulette.name || 'Roleta Desconhecida';
    
    // Extrair números
    let numeros: number[] = [];
    
    if (roulette.numeros && Array.isArray(roulette.numeros)) {
      numeros = roulette.numeros;
    } else if (roulette.numero && Array.isArray(roulette.numero)) {
      numeros = roulette.numero;
    }
    
    // Garantir que todos os valores são números
    numeros = numeros.map(n => {
      if (typeof n === 'number') return n;
      if (typeof n === 'string') {
        const parsed = parseInt(n, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    });
    
    return {
      id,
      nome,
      numeros,
      ultimoNumero: numeros.length > 0 ? numeros[0] : null,
      ultimaAtualizacao: roulette.timestamp || new Date().toISOString()
    };
  }
  
  /**
   * Busca todas as roletas
   */
  async getAllRoulettes() {
    try {
      const roulettes = await this.fetchAllRoulettes();
      return roulettes.map(this.processRouletteData.bind(this));
    } catch (error) {
      logger.error('Erro ao buscar todas as roletas:', error);
      return [];
    }
  }
  
  /**
   * Determina a cor de um número de roleta
   */
  private determinarCorNumero(numero: number): string {
    if (numero === 0) return 'verde';
    
    // Números vermelhos na roleta européia padrão
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    return numerosVermelhos.includes(numero) ? 'vermelho' : 'preto';
  }
}

export default FetchService; 