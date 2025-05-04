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

// Adicionar declarações de tipos para extensões do Window
declare global {
  interface Window {
    auth?: {
      getToken?: () => Promise<string | null>;
    };
    authContext?: {
      getToken?: () => Promise<string | null>;
    };
  }
}

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
    
    // Executar diagnóstico e reparo de tokens na inicialização
    this.repararTokensAutomaticamente();
    
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
   * Este método agora usa a normalização e mecanismo de retry para garantir consistência.
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
      
      // Obter token de autenticação dos cookies
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };
      
      // Tentar obter o token dos cookies
      const tokenCookie = getCookie('token') || getCookie('token_alt');
      let authToken = '';
      
      if (tokenCookie) {
        // Verificar se o token tem o prefixo 'Bearer' incorretamente incluído no valor
        if (tokenCookie.startsWith('Bearer ')) {
          console.log('[GlobalRouletteDataService] ⚠️ Token inclui prefixo Bearer, corrigindo formato');
          authToken = tokenCookie.replace('Bearer ', '');
          
          // Corrigir os cookies
          document.cookie = `token=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
          document.cookie = `token_alt=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
        } else {
          authToken = tokenCookie;
        }
        
        console.log('[GlobalRouletteDataService] ✅ Token de autenticação obtido dos cookies');
      } else {
        // Se não encontrou nos cookies, verificar localStorage
        const possibleKeys = [
          'auth_token',
          'token',
          'auth_token_backup',
          'accessToken',
          'jwt_token',
          'authentication'
        ];
        
        for (const key of possibleKeys) {
          const token = localStorage.getItem(key);
          if (token) {
            // Verificar se o token tem o prefixo 'Bearer' incorretamente incluído
            if (token.startsWith('Bearer ')) {
              console.log(`[GlobalRouletteDataService] ⚠️ Token em localStorage.${key} inclui prefixo Bearer, corrigindo`);
              authToken = token.replace('Bearer ', '');
              localStorage.setItem(key, authToken);
            } else {
              authToken = token;
            }
            
            console.log(`[GlobalRouletteDataService] ✅ Token encontrado no localStorage: ${key}`);
            
            // Restaurar para cookies também
            document.cookie = `token=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
            document.cookie = `token_alt=${authToken}; path=/; max-age=2592000; SameSite=Lax`;
            console.log('[GlobalRouletteDataService] Token restaurado para cookies');
            
            break;
          }
        }
      }
      
      // Criar cabeçalhos com o token de autenticação
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Verificar se temos um formato de token bem-sucedido no passado
      const tokenFormatSuccess = localStorage.getItem('token_format_success');
      
      if (tokenFormatSuccess && authToken) {
        console.log(`[GlobalRouletteDataService] Usando formato de token previamente bem-sucedido: ${tokenFormatSuccess}`);
        
        switch (tokenFormatSuccess) {
          case 'padrao':
            headers['Authorization'] = `Bearer ${authToken}`;
            break;
          case 'sem-espaco':
            headers['Authorization'] = `Bearer${authToken}`;
            break;
          case 'sem-bearer':
            headers['Authorization'] = authToken;
            break;
          case 'minusculo':
            headers['authorization'] = `Bearer ${authToken}`;
            break;
          case 'x-access-token':
            headers['x-access-token'] = authToken;
            break;
          default:
            // Formato padrão se não encontrar formato específico
            headers['Authorization'] = `Bearer ${authToken}`;
            console.log('[GlobalRouletteDataService] ✅ Token de autenticação adicionado ao cabeçalho da requisição');
        }
      } else if (authToken) {
        // Adicionar token de autenticação no formato padrão se disponível
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('[GlobalRouletteDataService] ✅ Token de autenticação adicionado ao cabeçalho da requisição');
      } else {
        console.warn('[GlobalRouletteDataService] ⚠️ Nenhum token de autenticação encontrado, a requisição pode falhar com 401');
      }

      // Buscar dados da API (usando o mecanismo de retry avançado)
      console.log('[GlobalRouletteDataService] Fazendo requisição à API...');
      const response = await this.fetchWithRetry('/api/roulettes', {
        method: 'GET',
        headers,
        credentials: 'include' // Importante: enviar cookies com a requisição
      }, 3); // Permitir até 3 tentativas de retry com diferentes formatos

      if (!response.ok) {
        // Se ainda falha após todas as tentativas, tentar uma abordagem alternativa
        if (response.status === 401) {
          console.warn('[GlobalRouletteDataService] ⚠️ Erro 401 após todas as tentativas, usando cache local se disponível');
          
          // Tentar restaurar do cache local
          try {
            const cacheData = localStorage.getItem('roulette_data_cache');
            if (cacheData) {
              const parsed = JSON.parse(cacheData);
              if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
                console.log(`[GlobalRouletteDataService] ⚠️ Usando ${parsed.data.length} roletas do cache como fallback`);
                
                // Atualizar dados do serviço e notificar
                this.rouletteData = parsed.data;
                this.lastFetchTime = Date.now(); // Atualizar timestamp para evitar muitas tentativas
                
                // Registrar o erro para diagnóstico
                this.fetchError = new Error(`Erro 401 ao acessar API. Usando cache. Recomendação: diagnosticarAutenticacao()`);
                
                // Notificar assinantes dos dados do cache
                this.notifySubscribers();
                
                // Retornar dados do cache
                return this.rouletteData;
              }
            }
          } catch (e) {
            console.warn('[GlobalRouletteDataService] Erro ao restaurar dados do cache:', e);
          }
          
          // Se chegamos aqui, não conseguimos recuperar do cache
          throw new Error(`Erro 401 Unauthorized: Token inválido ou ausente. Execute diagnosticarAutenticacao()`);
        }
        
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
   * Verifica se os dados estão expirados ou indisponíveis e força atualização se necessário
   * Chamado quando um componente solicita dados mas o serviço retorna vazio
   */
  public checkAndForceRefreshIfNeeded(): void {
    const now = Date.now();
    const needsRefresh = 
      this.rouletteData.length === 0 || // Sem dados
      (now - this.lastFetchTime > 30000); // Dados com mais de 30 segundos
    
    if (needsRefresh && !this.isFetching) {
      console.log('[GlobalRouletteDataService] 🔄 Forçando atualização devido a dados ausentes ou expirados');
      
      // Se houver dados antigos no localStorage, vamos restaurá-los temporariamente
      try {
        const cacheData = localStorage.getItem('roulette_data_cache');
        if (cacheData) {
          const parsed = JSON.parse(cacheData);
          if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
            console.log(`[GlobalRouletteDataService] ⚠️ Usando ${parsed.data.length} roletas do cache temporariamente`);
            this.rouletteData = parsed.data;
            
            // Notificar assinantes sobre os dados do cache
            this.notifySubscribers();
          }
        }
      } catch (e) {
        console.warn('[GlobalRouletteDataService] Erro ao restaurar dados do cache:', e);
      }
      
      // Iniciar uma nova busca
      this.fetchRouletteData();
    }
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
      
      // Verificar e forçar atualização se necessário
      this.checkAndForceRefreshIfNeeded();
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

  /**
   * Método para recuperar de falhas de autenticação
   * Isso tenta obter um novo token se a requisição falhar com 401
   */
  private async recoverFromAuthFailure(): Promise<string | null> {
    console.log('[GlobalRouletteDataService] 🔄 Tentando recuperar de falha de autenticação...');
    
    // Tentativa 1: Verificar novamente todos os possíveis locais de armazenamento
    try {
      // Primeiro tentar no localStorage com todas as chaves possíveis
      const possibleKeys = [
        'auth_token',
        'token',
        'auth_token_backup',
        'accessToken',
        'jwt_token',
        'authentication'
      ];
      
      for (const key of possibleKeys) {
        const token = localStorage.getItem(key);
        if (token) {
          console.log(`[GlobalRouletteDataService] ✅ Token alternativo encontrado em localStorage.${key}`);
          
          // Restaurar o token para cookies
          document.cookie = `token=${token}; path=/; max-age=2592000; SameSite=Lax`;
          document.cookie = `token_alt=${token}; path=/; max-age=2592000; SameSite=Lax`;
          
          return token;
        }
      }
      
      // Tentativa 2: Verificar se existe um método no sistema de autenticação para obter o token
      if (window.auth && typeof window.auth.getToken === 'function') {
        try {
          const token = await window.auth.getToken();
          if (token) {
            console.log('[GlobalRouletteDataService] ✅ Token obtido do sistema de autenticação');
            return token;
          }
        } catch (e) {
          console.warn('[GlobalRouletteDataService] Erro ao obter token do sistema de autenticação:', e);
        }
      }
      
      // Tentativa 3: Verificar se há um objeto AuthContext no window
      if (window.authContext && typeof window.authContext.getToken === 'function') {
        try {
          const token = await window.authContext.getToken();
          if (token) {
            console.log('[GlobalRouletteDataService] ✅ Token obtido do AuthContext');
            return token;
          }
        } catch (e) {
          console.warn('[GlobalRouletteDataService] Erro ao obter token do AuthContext:', e);
        }
      }
      
      console.warn('[GlobalRouletteDataService] ❌ Não foi possível recuperar de falha de autenticação');
      return null;
    } catch (error) {
      console.error('[GlobalRouletteDataService] ❌ Erro durante recuperação de autenticação:', error);
      return null;
    }
  }

  /**
   * Ferramenta de diagnóstico para problemas de autenticação
   * Compara o formato do token e tenta diferentes métodos de envio
   */
  public async fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
    try {
      // Verificar se temos um token salvo do formato que funcionou
      const tokenFormatSuccess = localStorage.getItem('token_format_success');
      
      if (tokenFormatSuccess) {
        // Usar o formato que funcionou anteriormente
        console.log(`[GlobalRouletteDataService] Usando formato de token com sucesso anterior: ${tokenFormatSuccess}`);
        
        // Obter token limpo (sem Bearer)
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return undefined;
        };
        
        const token = getCookie('token') || getCookie('token_alt') || localStorage.getItem('token') || '';
        const tokenSemBearer = token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
        
        // Substituir cabeçalho de autorização pelo formato que funcionou
        if (options.headers) {
          const headers = options.headers as Record<string, string>;
          
          // Remover cabeçalho existente
          delete headers['Authorization'];
          delete headers['authorization'];
          delete headers['x-access-token'];
          
          // Adicionar no formato que funcionou
          switch (tokenFormatSuccess) {
            case 'padrao':
              headers['Authorization'] = `Bearer ${tokenSemBearer}`;
              break;
            case 'sem-espaco':
              headers['Authorization'] = `Bearer${tokenSemBearer}`;
              break;
            case 'sem-bearer':
              headers['Authorization'] = tokenSemBearer;
              break;
            case 'minusculo':
              headers['authorization'] = `Bearer ${tokenSemBearer}`;
              break;
            case 'x-access-token':
              headers['x-access-token'] = tokenSemBearer;
              break;
          }
        }
      }
      
      const response = await fetch(url, options);
      
      // Se for 401 Unauthorized e ainda temos tentativas, tentar recuperar
      if (response.status === 401 && retries > 0) {
        console.warn('[GlobalRouletteDataService] ⚠️ Erro 401 Unauthorized, tentando recuperar...');
        
        // 1. Tentar restaurar token do localStorage para cookies
        const possibleKeys = ['auth_token', 'token', 'accessToken', 'jwt_token', 'authentication'];
        let tokenRestored = false;
        
        for (const key of possibleKeys) {
          const token = localStorage.getItem(key);
          if (token) {
            const tokenToSave = token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
            document.cookie = `token=${tokenToSave}; path=/; max-age=2592000; SameSite=Lax`;
            document.cookie = `token_alt=${tokenToSave}; path=/; max-age=2592000; SameSite=Lax`;
            console.log(`[GlobalRouletteDataService] ✅ Token restaurado de localStorage.${key} para cookies`);
            tokenRestored = true;
            break;
          }
        }
        
        // 2. Se restauramos o token, tentar novamente com o token atualizado
        if (tokenRestored) {
          console.log('[GlobalRouletteDataService] 🔄 Repetindo requisição com token restaurado...');
          return this.fetchWithRetry(url, options, retries - 1);
        }
        
        // 3. Se não conseguimos restaurar, tentar diferentes formatos de autenticação
        if (!tokenRestored && retries > 1) {
          console.log('[GlobalRouletteDataService] 🔄 Tentando formato alternativo de autorização...');
          
          // Obter token dos cookies
          const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
            return undefined;
          };
          
          const token = getCookie('token') || getCookie('token_alt') || '';
          if (token) {
            const tokenSemBearer = token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
            const newOptions = { ...options };
            const headers = newOptions.headers as Record<string, string>;
            
            // Testar formatos alternativos - verificar qual retries estamos para escolher um formato
            if (retries === 3) {
              // Formato 1: Authorization sem espaço
              headers['Authorization'] = `Bearer${tokenSemBearer}`;
              localStorage.setItem('token_format_trying', 'sem-espaco');
            } else if (retries === 2) {
              // Formato 2: authorization minúsculo
              delete headers['Authorization'];
              headers['authorization'] = `Bearer ${tokenSemBearer}`;
              localStorage.setItem('token_format_trying', 'minusculo');
            } else {
              // Formato 3: x-access-token
              delete headers['Authorization'];
              delete headers['authorization'];
              headers['x-access-token'] = tokenSemBearer;
              localStorage.setItem('token_format_trying', 'x-access-token');
            }
            
            console.log(`[GlobalRouletteDataService] Tentando formato: ${localStorage.getItem('token_format_trying')}`);
            
            // Tentar novamente com o novo formato
            const retryResponse = await fetch(url, newOptions);
            
            // Se funcionou, salvar o formato para uso futuro
            if (retryResponse.ok) {
              console.log(`[GlobalRouletteDataService] ✅ Formato ${localStorage.getItem('token_format_trying')} funcionou!`);
              localStorage.setItem('token_format_success', localStorage.getItem('token_format_trying') || '');
              return retryResponse;
            }
            
            // Se ainda não funcionou, tentar o próximo formato
            return this.fetchWithRetry(url, options, retries - 1);
          }
        }
        
        // 4. Tentar obter um novo token através de método existente
        const newToken = await this.recoverFromAuthFailure();
        
        if (newToken) {
          // Atualizar os headers com o novo token
          const newOptions = { ...options };
          
          if (!newOptions.headers) {
            newOptions.headers = {};
          }
          
          // Garantir que headers é um objeto
          const headers = newOptions.headers as Record<string, string>;
          headers['Authorization'] = `Bearer ${newToken}`;
          
          console.log('[GlobalRouletteDataService] 🔄 Repetindo requisição com novo token...');
          
          // Tentar novamente com o novo token
          return this.fetchWithRetry(url, newOptions, retries - 1);
        }
      }
      
      // Se a resposta for ok e estávamos testando um formato, salvar o formato que funcionou
      if (response.ok && localStorage.getItem('token_format_trying')) {
        console.log(`[GlobalRouletteDataService] ✅ Formato ${localStorage.getItem('token_format_trying')} funcionou!`);
        localStorage.setItem('token_format_success', localStorage.getItem('token_format_trying') || '');
      }
      
      return response;
    } catch (error) {
      console.error('[GlobalRouletteDataService] ❌ Erro durante fetchWithRetry:', error);
      throw error;
    }
  }

  /**
   * Executa reparo automático de tokens na inicialização
   * Isso ajuda a evitar problemas de 401 quando há problemas com o formato do token
   */
  private repararTokensAutomaticamente(): void {
    console.log('[GlobalRouletteDataService] 🩺 Verificando e corrigindo tokens automaticamente...');
    
    try {
      // 1. Verificar cookies
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };
      
      // Verificar e corrigir token nos cookies
      const tokenCookie = getCookie('token') || getCookie('token_alt');
      let cookieFixed = false;
      
      if (tokenCookie) {
        if (tokenCookie.startsWith('Bearer ')) {
          // Corrigir cookie com prefixo Bearer
          const tokenCorrigido = tokenCookie.replace('Bearer ', '');
          document.cookie = `token=${tokenCorrigido}; path=/; max-age=2592000; SameSite=Lax`;
          document.cookie = `token_alt=${tokenCorrigido}; path=/; max-age=2592000; SameSite=Lax`;
          console.log('[GlobalRouletteDataService] ✅ Token corrigido nos cookies (removido prefixo Bearer)');
          cookieFixed = true;
        } else {
          console.log('[GlobalRouletteDataService] ✓ Token nos cookies está no formato correto');
        }
      } else {
        console.log('[GlobalRouletteDataService] ⚠️ Nenhum token encontrado nos cookies');
      }
      
      // 2. Verificar localStorage
      const possibleKeys = ['auth_token', 'token', 'accessToken', 'jwt_token', 'authentication'];
      let foundInLocalStorage = false;
      let localStorageFixed = false;
      
      for (const key of possibleKeys) {
        const token = localStorage.getItem(key);
        if (token) {
          foundInLocalStorage = true;
          
          // Verificar formato
          if (token.startsWith('Bearer ')) {
            // Corrigir token com prefixo Bearer
            const tokenCorrigido = token.replace('Bearer ', '');
            localStorage.setItem(key, tokenCorrigido);
            console.log(`[GlobalRouletteDataService] ✅ Token corrigido no localStorage.${key} (removido prefixo Bearer)`);
            localStorageFixed = true;
          }
          
          // Se não há token nos cookies, restaurar do localStorage
          if (!tokenCookie) {
            const tokenToSave = token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
            document.cookie = `token=${tokenToSave}; path=/; max-age=2592000; SameSite=Lax`;
            document.cookie = `token_alt=${tokenToSave}; path=/; max-age=2592000; SameSite=Lax`;
            console.log(`[GlobalRouletteDataService] ✅ Token restaurado de localStorage.${key} para cookies`);
            cookieFixed = true;
          }
        }
      }
      
      if (!foundInLocalStorage && !tokenCookie) {
        console.warn('[GlobalRouletteDataService] ⚠️ Nenhum token encontrado! As requisições podem falhar com 401');
      }
      
      // 3. Verificar formatos de token que funcionaram anteriormente
      const tokenFormatSuccess = localStorage.getItem('token_format_success');
      if (tokenFormatSuccess) {
        console.log(`[GlobalRouletteDataService] ℹ️ Formato de token com sucesso anterior: ${tokenFormatSuccess}`);
      }
      
      // Remover formato de token que está sendo testado (caso tenha ficado de uma sessão anterior)
      if (localStorage.getItem('token_format_trying')) {
        localStorage.removeItem('token_format_trying');
      }
      
      if (cookieFixed || localStorageFixed) {
        console.log('[GlobalRouletteDataService] ✅ Tokens corrigidos com sucesso na inicialização');
      } else {
        console.log('[GlobalRouletteDataService] ✓ Não foram necessárias correções nos tokens');
      }
    } catch (error) {
      console.error('[GlobalRouletteDataService] ❌ Erro ao tentar corrigir tokens:', error);
    }
  }
  
  /**
   * Executa diagnóstico completo e tenta reparar problemas de autenticação
   * Este método público pode ser chamado para solucionar problemas de 401
   */
  public corrigirProblemasAutenticacao(): void {
    console.log('[GlobalRouletteDataService] 🔧 Iniciando reparo de problemas de autenticação...');
    
    try {
      // 1. Executar correção de tokens
      this.repararTokensAutomaticamente();
      
      // 2. Limpar cache de formato bem-sucedido para forçar novos testes
      localStorage.removeItem('token_format_success');
      localStorage.removeItem('token_format_trying');
      
      // 3. Forçar atualização com novas configurações
      this.forceUpdateAndClearCache();
      
      // 4. Executar diagnóstico completo de autenticação
      diagnosticarAutenticacao();
    } catch (error) {
      console.error('[GlobalRouletteDataService] ❌ Erro durante correção de autenticação:', error);
    }
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
    
    // Verificar dados em cache na memória
    const cachedData = globalService.getAllRoulettes();
    if (cachedData && cachedData.length > 0) {
      console.log(`✅ Dados em cache da memória disponíveis: ${cachedData.length} roletas`);
      console.log('Amostra de dados:', cachedData.slice(0, 2).map(r => ({
        id: r.id,
        nome: r.nome || r.name,
        numeros: Array.isArray(r.numero) ? r.numero.length : 0
      })));
    } else {
      console.log('❌ Nenhum dado em cache na memória disponível');
    }
    
    // Verificar status de busca
    console.log(`Estado de busca: ${globalService.isFetchingData() ? 'Em andamento' : 'Inativo'}`);
    console.log(`Último erro: ${globalService.getLastError() ? globalService.getLastError()?.message : 'Nenhum'}`);
    
    // Executar verificação e atualização forçada se necessário
    globalService.checkAndForceRefreshIfNeeded();
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
          
          // Tentar restaurar o cache se o serviço estiver sem dados
          const globalService = GlobalRouletteDataService.getInstance();
          const currentData = globalService.getAllRoulettes();
          if (currentData.length === 0 && parsedCache.data.length > 0) {
            console.log('⚠️ Serviço está sem dados mas cache tem dados. Recomendação: reiniciar a página');
          }
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
    // Verificar cookies primeiro (mais confiável)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };
    
    // Verificar cookies de autenticação
    const tokenCookie = getCookie('token') || getCookie('token_alt');
    if (tokenCookie) {
      foundToken = true;
      console.log('✅ Token encontrado nos cookies');
      // Não mostrar o token completo por segurança
      console.log(`Token: ${tokenCookie.substring(0, 10)}...${tokenCookie.substring(tokenCookie.length - 5)}`);
      
      try {
        // Verificar se é um JWT válido
        const parts = tokenCookie.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log('JWT válido, payload contém:', Object.keys(payload).join(', '));
          
          // Verificar expiração
          if (payload.exp) {
            const expTime = payload.exp * 1000;
            const now = Date.now();
            if (expTime > now) {
              console.log(`✅ Token válido por mais ${Math.round((expTime - now) / 1000 / 60)} minutos`);
            } else {
              console.log('❌ Token EXPIRADO! Expirou há', Math.round((now - expTime) / 1000 / 60), 'minutos');
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Não foi possível decodificar o token como JWT');
      }
    }
    
    // Se não encontrou nos cookies, verificar localStorage
    if (!foundToken) {
      for (const key of possibleKeys) {
        const token = localStorage.getItem(key);
        if (token) {
          foundToken = true;
          console.log(`✅ Token encontrado no localStorage: ${key}`);
          console.log(`Token: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);
          
          // Recomendar restaurar para cookies
          console.log('⚠️ Token encontrado apenas no localStorage, não nos cookies');
          console.log('Recomendação: Restaurar o token para cookies');
          console.log(`document.cookie = "token=${token}; path=/; max-age=2592000; SameSite=Lax";`);
          
          break;
        }
      }
    }
    
    if (!foundToken) {
      console.log('❌ PROBLEMA CRÍTICO: Nenhum token de autenticação encontrado!');
      console.log('Isso pode causar falhas 401 Unauthorized nas chamadas à API');
      console.log('Recomendação: Fazer logout e login novamente');
    }
  } catch (authError) {
    console.error('❌ Erro ao verificar autenticação:', authError);
  }
  
  // Testar uma requisição direta à API
  console.log('\n📋 Teste de conexão direta com a API:');
  try {
    console.log('Iniciando teste de conexão direta com /api/roulettes...');
    // Este teste será assíncrono, então o resultado aparecerá no console depois
    fetch('/api/roulettes', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    })
    .then(response => {
      console.log(`Resposta da API: ${response.status} ${response.statusText}`);
      if (response.ok) {
        console.log('✅ API respondeu com sucesso (200 OK)');
        return response.json();
      } else if (response.status === 401) {
        console.log('❌ API retornou erro de autenticação (401 Unauthorized)');
        console.log('Problema confirmado: Token inválido ou ausente');
      } else {
        console.log(`❌ API retornou erro: ${response.status}`);
      }
      return null;
    })
    .then(data => {
      if (data) {
        console.log(`✅ Dados recebidos: ${Array.isArray(data) ? data.length : 'não é array'} itens`);
      }
    })
    .catch(error => {
      console.error('❌ Erro na requisição de teste:', error);
    });
  } catch (e) {
    console.error('❌ Erro ao tentar teste direto com a API:', e);
  }
  
  console.log('\n==================== FIM DO DIAGNÓSTICO ====================');
  console.log('Recomendações gerais:');
  console.log('1. Se não há dados de roletas, tente recarregar a página');
  console.log('2. Se o erro persistir, faça logout e login novamente');
  console.log('3. Verifique a conexão com a internet');
  console.log('4. Limpe o cache do navegador se o problema continuar');
} 

/**
 * Ferramenta de diagnóstico para problemas de autenticação
 * Compara o formato do token e tenta diferentes métodos de envio
 */
export function diagnosticarAutenticacao(): void {
  console.log('==================== DIAGNÓSTICO DE AUTENTICAÇÃO ====================');
  
  // 1. Verificar cookies e localStorage
  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
  };
  
  // Obter token dos cookies
  const tokenCookie = getCookie('token') || getCookie('token_alt');
  console.log('📋 Verificação de token nos cookies:');
  if (tokenCookie) {
    const maskedToken = `${tokenCookie.substring(0, 15)}...${tokenCookie.substring(tokenCookie.length - 10)}`;
    console.log(`✅ Token encontrado nos cookies: ${maskedToken}`);
    
    // Verificar formato do token
    if (tokenCookie.startsWith('Bearer ')) {
      console.log('⚠️ O token contém o prefixo "Bearer " dentro do seu valor');
      console.log('Isso pode causar problemas quando o prefixo é adicionado novamente nos cabeçalhos');
      
      // Corrigir automaticamente
      const tokenCorrigido = tokenCookie.replace('Bearer ', '');
      document.cookie = `token=${tokenCorrigido}; path=/; max-age=2592000; SameSite=Lax`;
      document.cookie = `token_alt=${tokenCorrigido}; path=/; max-age=2592000; SameSite=Lax`;
      console.log('✅ Token corrigido e salvo nos cookies');
    }
  } else {
    console.log('❌ Nenhum token encontrado nos cookies');
  }
  
  // Verificar localStorage
  console.log('\n📋 Verificação de token no localStorage:');
  const possibleKeys = ['auth_token', 'token', 'accessToken', 'jwt_token', 'authentication'];
  let foundInLocalStorage = false;
  
  for (const key of possibleKeys) {
    const token = localStorage.getItem(key);
    if (token) {
      foundInLocalStorage = true;
      console.log(`✅ Token encontrado no localStorage: ${key}`);
      
      // Verificar formato do token
      if (token.startsWith('Bearer ')) {
        console.log('⚠️ O token no localStorage contém o prefixo "Bearer "');
        
        // Corrigir automaticamente
        const tokenCorrigido = token.replace('Bearer ', '');
        localStorage.setItem(key, tokenCorrigido);
        console.log(`✅ Token corrigido e salvo no localStorage (${key})`);
      }
      
      // Se não existir nos cookies, restaurar
      if (!tokenCookie) {
        const tokenToSave = token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
        document.cookie = `token=${tokenToSave}; path=/; max-age=2592000; SameSite=Lax`;
        document.cookie = `token_alt=${tokenToSave}; path=/; max-age=2592000; SameSite=Lax`;
        console.log('✅ Token do localStorage restaurado para cookies');
      }
    }
  }
  
  if (!foundInLocalStorage && !tokenCookie) {
    console.log('❌ PROBLEMA CRÍTICO: Nenhum token encontrado em qualquer armazenamento!');
    console.log('Recomendação: Fazer logout e login novamente para renovar o token');
  }
  
  // 2. Testar diferentes formatos de cabeçalho
  console.log('\n📋 Teste de formatos de cabeçalho de autorização:');
  const token = tokenCookie || localStorage.getItem('token') || '';
  
  if (!token) {
    console.log('❌ Sem token disponível para testar cabeçalhos');
    return;
  }
  
  const tokenSemBearer = token.startsWith('Bearer ') ? token.replace('Bearer ', '') : token;
  
  // Preparar diferentes formatos de cabeçalho para teste
  const cabecalhosTeste = [
    { nome: 'Padrão', headers: { 'Authorization': `Bearer ${tokenSemBearer}` } },
    { nome: 'Sem espaço', headers: { 'Authorization': `Bearer${tokenSemBearer}` } },
    { nome: 'Sem Bearer', headers: { 'Authorization': tokenSemBearer } },
    { nome: 'Minúsculo', headers: { 'authorization': `Bearer ${tokenSemBearer}` } },
    { nome: 'x-access-token', headers: { 'x-access-token': tokenSemBearer } }
  ];
  
  console.log('Iniciando testes de diferentes formatos de cabeçalho...');
  console.log('Os resultados aparecerão no console em alguns segundos');
  
  // Realizar testes assíncronos para cada formato
  cabecalhosTeste.forEach(({ nome, headers }) => {
    fetch('/api/health', {  // Usar um endpoint simples para teste
      method: 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })
    .then(response => {
      console.log(`Teste de cabeçalho "${nome}": ${response.status} ${response.statusText}`);
    })
    .catch(error => {
      console.error(`Erro no teste de cabeçalho "${nome}":`, error);
    });
  });
  
  // 3. Corrigir o método fetchWithRetry para tentar diferentes formatos
  console.log('\n📋 Recomendações:');
  console.log('1. Verifique os resultados dos testes de cabeçalho acima');
  console.log('2. Se algum formato teve sucesso, use-o nas requisições futuras');
  console.log('3. Se todos falharem, tente fazer logout e login novamente');
  console.log('4. Depois de fazer login novamente, execute esta função para verificar o novo token');
  
  console.log('\n==================== FIM DO DIAGNÓSTICO ====================');
} 