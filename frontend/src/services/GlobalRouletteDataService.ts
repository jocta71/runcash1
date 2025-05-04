import { fetchWithCorsSupport } from '../utils/api-helpers';
import EventService from './EventService';

/**
 * IMPORTANTE: Este serviço deve acessar APENAS a rota /api/roulettes sem parâmetros adicionais!
 * Adicionar parâmetros de timestamp ou outros valores à URL causa falhas na API.
 * 
 * Este serviço fornece acesso global aos dados das roletas.
 */

// Intervalo de polling padrão em milissegundos (4 segundos)
const POLLING_INTERVAL = 4000;

// Tempo de vida do cache em milissegundos (15 segundos)
// const CACHE_TTL = 15000;

// Intervalo mínimo entre requisições forçadas (4 segundos)
const MIN_FORCE_INTERVAL = 4000;

// Limite padrão para requisições normais (1000 itens)
const DEFAULT_LIMIT = 1000;

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
  private lastFetchTime: number = 0;
  private isFetching: boolean = false;
  private pollingTimer: number | null = null;
  private subscribers: Map<string, SubscriberCallback> = new Map();
  private _currentFetchPromise: Promise<any[]> | null = null;
  private fetchError: Error | null = null;
  
  // Construtor privado para garantir Singleton
  private constructor() {
    console.log('[GlobalRouletteService] Inicializando serviço global de roletas');
    this.startPolling();
  }

  /**
   * Retorna a instância singleton do serviço
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
   * Normaliza os dados de roleta para garantir um formato consistente
   * Isso resolve diferentes formatos que podem ser retornados pela API
   * @param data Os dados a serem normalizados
   * @returns Array normalizado de objetos de roleta
   */
  private normalizeRouletteData(data: any): any[] {
    console.log('[GlobalRouletteDataService] 🔍 Normalizando dados de roleta...');
    
    // Diagnóstico do formato dos dados recebidos
    console.log(`[GlobalRouletteDataService] Tipo de dados recebidos: ${typeof data}`);
    console.log(`[GlobalRouletteDataService] É array? ${Array.isArray(data)}`);
    
    if (!data) {
      console.warn('[GlobalRouletteDataService] ⚠️ Dados recebidos são nulos ou indefinidos');
      return [];
    }
    
    // Caso: já é um array
    if (Array.isArray(data)) {
      console.log(`[GlobalRouletteDataService] Dados já são um array com ${data.length} itens`);
      if (data.length > 0) {
        console.log('[GlobalRouletteDataService] Amostra de chaves do primeiro item:', Object.keys(data[0]));
      }
      return data;
    }
    
    // Caso: é um objeto (possivelmente contendo um array)
    if (typeof data === 'object') {
      console.log('[GlobalRouletteDataService] Dados são um objeto. Chaves disponíveis:', Object.keys(data));
      
      // Tentar encontrar um array dentro do objeto
      // Padrões comuns incluem: data.roulettes, data.data, data.items, etc.
      const possibleArrayKeys = ['roulettes', 'data', 'items', 'results', 'roletas', 'content'];
      
      for (const key of possibleArrayKeys) {
        if (data[key] && Array.isArray(data[key])) {
          console.log(`[GlobalRouletteDataService] Encontrado array em data.${key} com ${data[key].length} itens`);
          return data[key];
        }
      }
      
      // Se não encontramos em nenhuma chave conhecida, verificamos se o próprio objeto tem
      // características de uma coleção (itens com propriedades numéricas)
      const numericKeys = Object.keys(data).filter(key => !isNaN(Number(key)));
      if (numericKeys.length > 0) {
        console.log(`[GlobalRouletteDataService] Objeto parece uma coleção com ${numericKeys.length} itens numéricos`);
        return numericKeys.map(key => data[key]);
      }
      
      // Último recurso: tentar acessar Object.values se o objeto tiver valores que parecem roletas
      const values = Object.values(data);
      if (values.length > 0 && values.every(v => typeof v === 'object')) {
        console.log(`[GlobalRouletteDataService] Usando Object.values para extrair ${values.length} itens`);
        return values;
      }
      
      // Se o objeto tiver as propriedades esperadas de uma única roleta, retornamos como array de um item
      if (data.id || data.name || data.nome) {
        console.log('[GlobalRouletteDataService] Objeto parece ser uma única roleta. Convertendo para array');
        return [data];
      }
    }
    
    console.warn('[GlobalRouletteDataService] ⚠️ Formato de dados desconhecido, retornando array vazio');
    return [];
  }
  
  /**
   * Método principal para buscar dados das roletas.
   * Este método agora usa a normalização para garantir consistência.
   * @returns Array de objetos de roleta (vazio se ocorrer erro)
   */
  private async fetchRouletteData(): Promise<any[]> {
    if (this.isFetching) {
      console.log('[GlobalRouletteDataService] Já existe uma busca em andamento, ignorando');
      return this.rouletteData || [];
    }

    this.isFetching = true;
    console.log('[GlobalRouletteDataService] 🔄 Iniciando busca de dados de roletas...');

    try {
      // Limpar qualquer erro anterior
      this.fetchError = null;

      // Buscar dados da API
      console.log('[GlobalRouletteDataService] Fazendo requisição à API...');
      const response = await fetch('/api/roulettes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include' // Importante: enviar cookies com a requisição
      });

      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
      }

      // Extrair e processar dados
      console.log('[GlobalRouletteDataService] Dados recebidos, processando...');
      const data = await response.json();
      
      // Usar a função de normalização para garantir formato consistente
      const normalizedData = this.normalizeRouletteData(data);
      
      if (normalizedData.length === 0) {
        console.warn('[GlobalRouletteDataService] ⚠️ Nenhuma roleta encontrada após normalização');
        this.fetchError = new Error('Nenhuma roleta encontrada nos dados');
      } else {
        console.log(`[GlobalRouletteDataService] ✅ ${normalizedData.length} roletas processadas com sucesso`);
        this.rouletteData = normalizedData;
        this.lastFetchTime = Date.now();
        
        // Salvar em cache
        try {
          localStorage.setItem('roulette_data_cache', JSON.stringify({
            data: this.rouletteData,
            timestamp: this.lastFetchTime
          }));
          console.log('[GlobalRouletteDataService] Dados salvos em cache');
        } catch (cacheError) {
          console.warn('[GlobalRouletteDataService] Erro ao salvar cache:', cacheError);
        }
        
        // Notificar assinantes
        this.notifySubscribers();
      }
      
      return this.rouletteData || [];
    } catch (error) {
      console.error('[GlobalRouletteDataService] ❌ Erro ao buscar dados:', error);
      this.fetchError = error;
      return this.rouletteData || [];
    } finally {
      this.isFetching = false;
      console.log('[GlobalRouletteDataService] Busca de dados concluída');
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
   * Força uma atualização imediata dos dados com limpeza de cache
   * Útil quando enfrentar problemas de carregamento
   */
  public forceUpdateAndClearCache(): void {
    console.log('[GlobalRouletteService] Forçando atualização e limpeza de cache');
    
    // Limpar dados atuais
    this.rouletteData = [];
    
    // Cancelar qualquer busca em andamento
    this.isFetching = false;
    
    // Redefinir última hora de busca
    this.lastFetchTime = 0;
    
    // Limpar cache do localStorage se existir
    try {
      localStorage.removeItem('roulette_data_cache');
      console.log('[GlobalRouletteService] Cache de localStorage limpo');
    } catch (e) {
      console.warn('[GlobalRouletteService] Erro ao limpar cache de localStorage:', e);
    }
    
    // Forçar nova busca
    this.fetchRouletteData();
  }
  
  /**
   * Obtém a roleta pelo nome
   * @param rouletteName Nome da roleta
   * @returns Objeto com dados da roleta ou undefined
   */
  public getRouletteByName(rouletteName: string): any {
    return this.rouletteData.find(roulette => {
      const name = roulette.nome || roulette.name || '';
      return name.toLowerCase() === rouletteName.toLowerCase();
    });
  }
  
  /**
   * Obtém todos os dados das roletas
   * @returns Array com todas as roletas
   */
  public getAllRoulettes(): any[] {
    const count = this.rouletteData?.length || 0;
    console.log(`[GlobalRouletteService] getAllRoulettes chamado, retornando ${count} roletas`);
    
    if (count === 0) {
      console.warn('[GlobalRouletteService] ATENÇÃO: Retornando array vazio de roletas!');
      
      // Verificar se devemos iniciar uma busca
      if (!this.isFetching && Date.now() - this.lastFetchTime > MIN_FORCE_INTERVAL) {
        console.log('[GlobalRouletteService] Iniciando busca automática de dados devido a pedido com dados vazios');
        this.fetchRouletteData();
      }
    }
    
    // Garantir que sempre retorne um array, mesmo se rouletteData for undefined
    return Array.isArray(this.rouletteData) ? this.rouletteData : [];
  }
  
  /**
   * Obtém todos os dados detalhados das roletas
   * @returns Array com todas as roletas (dados detalhados)
   */
  public getAllDetailedRoulettes(): any[] {
    // Agora retornamos os mesmos dados, pois sempre buscamos com limit=1000
    return this.rouletteData;
  }
  
  /**
   * Registra um callback para receber notificações quando os dados forem atualizados
   * @param id Identificador único para o subscriber
   * @param callback Função a ser chamada quando houver atualização
   */
  public subscribe(id: string, callback: SubscriberCallback): void {
    if (!id || typeof id !== 'string') {
      console.error('[GlobalRouletteService] ID inválido para subscription:', id);
      return;
    }
    
    if (typeof callback !== 'function') {
      console.error('[GlobalRouletteService] Callback inválido para subscription (não é uma função)');
      return;
    }
    
    // Verificar se já existe assinante com este ID
    if (this.subscribers.has(id)) {
      console.log(`[GlobalRouletteService] Assinante com ID ${id} já está registrado, atualizando callback`);
    } else {
      console.log(`[GlobalRouletteService] Novo assinante registrado: ${id}`);
    }
    
    this.subscribers.set(id, callback);
    
    // Chamar o callback imediatamente se já tivermos dados
    if (this.rouletteData.length > 0) {
      console.log(`[GlobalRouletteService] Notificando imediatamente o assinante ${id} com ${this.rouletteData.length} roletas`);
      try {
        callback();
      } catch (error) {
        console.error(`[GlobalRouletteService] Erro ao notificar inicialmente o assinante ${id}:`, error);
      }
    } else {
      console.log(`[GlobalRouletteService] Sem dados disponíveis para notificar o assinante ${id} imediatamente`);
      // Forçar uma atualização para buscar dados
      if (!this.isFetching) {
        console.log(`[GlobalRouletteService] Forçando busca de dados para o novo assinante ${id}`);
        this.fetchRouletteData();
      }
    }
  }
  
  /**
   * Registra um assinante para dados detalhados
   * @param id Identificador único para o subscriber
   * @param callback Função a ser chamada quando houver atualização
   */
  public subscribeToDetailedData(id: string, callback: SubscriberCallback): void {
    // Agora que temos apenas uma fonte de dados, direcionamos para o método principal
    this.subscribe(id, callback);
  }
  
  /**
   * Cancela a inscrição de um assinante
   * @param id Identificador do assinante
   */
  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }
  
  /**
   * Notifica todos os assinantes sobre atualização nos dados
   */
  private notifySubscribers(): void {
    console.log(`[GlobalRouletteService] Notificando ${this.subscribers.size} assinantes`);
    
    if (this.subscribers.size === 0) {
      console.warn('[GlobalRouletteService] ATENÇÃO: Não há assinantes registrados para receber dados!');
      console.log('[GlobalRouletteService] Verifique se os componentes estão chamando subscribe() corretamente');
      return;
    }
    
    if (this.rouletteData.length === 0) {
      console.warn('[GlobalRouletteService] ATENÇÃO: Notificando assinantes com array vazio de dados!');
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    this.subscribers.forEach((callback, id) => {
      try {
        console.log(`[GlobalRouletteService] Notificando assinante: ${id}`);
        callback();
        successCount++;
      } catch (error) {
        console.error(`[GlobalRouletteService] Erro ao notificar assinante ${id}:`, error);
        errorCount++;
      }
    });
    
    console.log(`[GlobalRouletteService] Notificação concluída: ${successCount} com sucesso, ${errorCount} com erros`);
  }
  
  /**
   * Busca dados detalhados (usando limit=1000) - método mantido para compatibilidade
   */
  public async fetchDetailedRouletteData(): Promise<any[]> {
    // Método mantido apenas para compatibilidade, mas agora usa o mesmo método principal
    return this.fetchRouletteData();
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
    console.log('[GlobalRouletteService] Serviço encerrado e recursos liberados');
  }

  /**
   * Método de diagnóstico para verificar o estado atual do serviço
   * Pode ser chamado de qualquer parte da aplicação para depuração
   */
  public diagnosticarEstado(): void {
    console.group('🔍 DIAGNÓSTICO DO SERVIÇO DE ROLETAS');
    console.log(`- Última atualização: ${new Date(this.lastFetchTime).toLocaleTimeString()}`);
    console.log(`- Tempo desde última atualização: ${Date.now() - this.lastFetchTime}ms`);
    console.log(`- Buscando dados agora: ${this.isFetching ? 'SIM' : 'NÃO'}`);
    console.log(`- Polling ativo: ${this.pollingTimer !== null ? 'SIM' : 'NÃO'}`);
    console.log(`- Número de assinantes: ${this.subscribers.size}`);
    console.log(`- Dados disponíveis: ${this.rouletteData.length} roletas`);
    
    if (this.rouletteData.length === 0) {
      console.warn('⚠️ ALERTA: Não há dados de roletas carregados!');
    }
    
    if (this.subscribers.size === 0) {
      console.warn('⚠️ ALERTA: Não há componentes registrados para receber dados!');
    }
    
    // Verificar token de autenticação
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };
    
    const tokenCookie = getCookie('token') || getCookie('token_alt');
    if (tokenCookie) {
      console.log('- Token nos cookies: SIM');
    } else {
      console.warn('⚠️ ALERTA: Não há token de autenticação nos cookies!');
      
      // Verificar localStorage
      const possibleKeys = ['auth_token_backup', 'token', 'auth_token', 'authToken'];
      let foundToken = false;
      
      for (const key of possibleKeys) {
        if (localStorage.getItem(key)) {
          console.log(`- Token no localStorage (${key}): SIM`);
          foundToken = true;
          break;
        }
      }
      
      if (!foundToken) {
        console.error('❌ ERRO CRÍTICO: Não há token de autenticação em nenhum local!');
      }
    }
    
    console.log('- Lista de assinantes:');
    this.subscribers.forEach((_, id) => {
      console.log(`  * ${id}`);
    });
    
    console.groupEnd();
    
    // Tentar uma atualização forçada se não houver dados
    if (this.rouletteData.length === 0 && !this.isFetching) {
      console.log('🔄 Iniciando atualização forçada de dados...');
      this.fetchRouletteData();
    }
  }

  // Adicionar método público para verificar estado de busca
  public isFetchingData(): boolean {
    return this.isFetching;
  }

  // Adicionar método público para obter último erro
  public getLastError(): Error | null {
    return this.fetchError;
  }
}

// Exportar a instância única do serviço
const globalRouletteDataService = GlobalRouletteDataService.getInstance();
export default globalRouletteDataService;
// Também exportar a classe para permitir o uso de getInstance() diretamente
export { GlobalRouletteDataService }; 

/**
 * Função de diagnóstico para identificar problemas no carregamento de roletas.
 * Esta função pode ser importada e executada em qualquer lugar da aplicação.
 */
export function diagnosticarCarregamentoRoletas(): void {
  console.log('==================== DIAGNÓSTICO DE ROLETAS ====================');
  console.log('Iniciando diagnóstico completo do sistema de carregamento de roletas');
  
  // Verificar serviço global
  console.log('\n📋 Serviço Global de Roletas:');
  try {
    const globalService = GlobalRouletteDataService.getInstance();
    console.log('✅ Instância do serviço global obtida com sucesso');
    
    // Verificar dados em cache
    const cachedData = globalService.getAllRoulettes();
    if (cachedData && cachedData.length > 0) {
      console.log(`✅ Dados em cache disponíveis: ${cachedData.length} roletas`);
      console.log('Amostra de dados:', cachedData.slice(0, 2));
    } else {
      console.log('❌ Nenhum dado em cache disponível');
    }
    
    // Verificar status de busca
    console.log(`Estado de busca: ${globalService.isFetchingData() ? 'Em andamento' : 'Inativo'}`);
    console.log(`Último erro: ${globalService.getLastError() ? globalService.getLastError()?.message : 'Nenhum'}`);
    
  } catch (error) {
    console.error('❌ Erro ao acessar o serviço global:', error);
  }
  
  // Verificar localStorage
  console.log('\n📋 Verificação de localStorage:');
  try {
    const cacheKey = 'roulette_data_cache';
    const cachedDataRaw = localStorage.getItem(cacheKey);
    if (cachedDataRaw) {
      try {
        const parsedCache = JSON.parse(cachedDataRaw);
        console.log('✅ Dados em cache local encontrados');
        console.log(`Timestamp do cache: ${new Date(parsedCache.timestamp).toLocaleString()}`);
        console.log(`Idade do cache: ${Math.round((Date.now() - parsedCache.timestamp) / 1000)} segundos`);
        if (parsedCache.data && Array.isArray(parsedCache.data)) {
          console.log(`Número de roletas em cache: ${parsedCache.data.length}`);
        } else {
          console.log('❌ Formato de cache inválido (data não é um array)');
        }
      } catch (parseError) {
        console.error('❌ Erro ao analisar cache JSON:', parseError);
      }
    } else {
      console.log('❌ Nenhum dado em cache local encontrado');
    }
  } catch (storageError) {
    console.error('❌ Erro ao acessar localStorage:', storageError);
  }
  
  // Verificar token de autenticação
  console.log('\n📋 Verificação de token de autenticação:');
  const possibleKeys = ['auth_token', 'token', 'accessToken', 'jwt_token', 'authentication'];
  let foundToken = false;
  
  try {
    for (const key of possibleKeys) {
      const token = localStorage.getItem(key);
      if (token) {
        foundToken = true;
        console.log(`✅ Token encontrado com a chave: ${key}`);
        // Não mostrar o token completo por segurança
        console.log(`Token: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);
        
        try {
          // Verificar se é um JWT válido tentando decodificar o payload
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('JWT parece válido, payload contém:', Object.keys(payload).join(', '));
            
            // Verificar expiração
            if (payload.exp) {
              const expTime = payload.exp * 1000; // Converter para milissegundos
              const now = Date.now();
              if (expTime > now) {
                console.log(`✅ Token válido por mais ${Math.round((expTime - now) / 1000 / 60)} minutos`);
              } else {
                console.log('❌ Token EXPIRADO! Expirou há', Math.round((now - expTime) / 1000 / 60), 'minutos');
              }
            }
          } else {
            console.log('⚠️ Token não parece ser um JWT válido (não tem 3 partes)');
          }
        } catch (e) {
          console.log('⚠️ Não foi possível decodificar o token como JWT');
        }
        
        break;
      }
    }
    
    if (!foundToken) {
      console.log('❌ PROBLEMA CRÍTICO: Nenhum token de autenticação encontrado!');
      console.log('Isso pode causar falhas 401 Unauthorized nas chamadas à API');
    }
    
    // Verificar cookies
    console.log('\n📋 Verificação de cookies:');
    const cookies = document.cookie.split(';');
    let foundAuthCookie = false;
    
    if (cookies.length > 0) {
      console.log(`Total de cookies: ${cookies.length}`);
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name && ['token', 'auth', 'jwt', 'authorization'].some(k => name.toLowerCase().includes(k))) {
          console.log(`✅ Cookie de autenticação encontrado: ${name}`);
          foundAuthCookie = true;
        }
      }
      
      if (!foundAuthCookie) {
        console.log('⚠️ Nenhum cookie de autenticação encontrado pelos nomes comuns');
      }
    } else {
      console.log('⚠️ Nenhum cookie disponível');
    }
  } catch (authError) {
    console.error('❌ Erro ao verificar autenticação:', authError);
  }
  
  // Informações sobre o endpoint
  console.log('\n📋 Informações do endpoint:');
  console.log('URL da API de roletas: /api/roulettes');
  console.log('IMPORTANTE: Este endpoint deve ser acessado SEM parâmetros de timestamp ou outras querystrings');
  console.log('IMPORTANTE: O endpoint deve receber o token JWT no cabeçalho Authorization: Bearer {token}');
  
  console.log('\n==================== FIM DO DIAGNÓSTICO ====================');
} 