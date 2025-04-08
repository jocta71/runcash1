import { getLogger } from "./logger";

const logger = getLogger('Throttler');

// Mapa para controlar os intervalos ativos por endpoint
const activeIntervals: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Mapa para rastrear a última vez que um request foi feito por endpoint
const lastRequestTimes: Map<string, number> = new Map();

// Mapa para armazenar callbacks por endpoint
const subscribers: Map<string, Array<(data: any) => void>> = new Map();

// Mapa para armazenar o cache de resposta por endpoint
const responseCache: Map<string, {data: any, timestamp: number}> = new Map();

// Controlar requisições em andamento para evitar duplicatas
const pendingRequests: Map<string, Promise<any>> = new Map();

// Intervalo mínimo entre requisições (11 segundos)
const MIN_REQUEST_INTERVAL = 11 * 1000; 

// Tempo de validade do cache (5 minutos)
const CACHE_VALIDITY = 5 * 60 * 1000;

// Endpoints prioritários que devem usar o proxy-roulette
const PROXY_ENDPOINTS = ['/api/ROULETTES', '/ROULETTES', 'ROULETTES', 'roulettes'];

// URL da API backend
const BACKEND_API_URL = 'https://backendapi-production-36b5.up.railway.app/api/ROULETTES';
const BACKUP_API_URL = 'https://backend-production-2f96.up.railway.app/api/ROULETTES';

// Flag para controlar quando devemos tentar o endpoint de backup
let useBackupEndpoint = false;
let lastFailedAttempt = 0;
const FAILURE_COOLDOWN = 30 * 1000; // 30 segundos entre tentativas após falha

// Dados fallback em caso de falha total de API
const FALLBACK_ROULETTES = [
  { _id: "419aa56c-bcff-67d2-f424-a6501bac4a36", nome: "Auto-Roulette VIP" },
  { _id: "f27dd03e-5282-fc78-961c-6375cef91565", nome: "Ruleta Automática" },
  { _id: "7d3c2c9f-2850-f642-861f-5bb4daf1806a", nome: "Brazilian Mega Roulette" },
  { _id: "e3345af9-e387-9412-209c-e793fe73e520", nome: "Bucharest Auto-Roulette" },
  { _id: "4cf27e48-2b9d-b58e-7dcc-48264c51d639", nome: "Immersive Roulette" }
];

// Headers para evitar detecção como bot ou captchas
const getDefaultHeaders = () => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  'bypass-tunnel-reminder': 'true',
  'Origin': window.location.origin,
  'Referer': window.location.origin,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
});

/**
 * Controlador de taxa de requisições para evitar múltiplas chamadas em curto espaço de tempo
 */
export const RequestThrottler = {
  MIN_REQUEST_INTERVAL: 11000, // intervalo mínimo entre requisições (11 segundos)
  CACHE_VALIDITY: 300000, // 5 minutos

  /**
   * Agenda uma requisição para ser executada respeitando o intervalo mínimo
   * @param key Identificador único para a requisição
   * @param callback Função que executa a requisição e retorna os dados
   * @param forceNow Força a execução imediata independente do intervalo
   * @param skipCache Define se deve ignorar o cache e forçar uma nova requisição
   * @param cacheTime Tempo personalizado de validade do cache (em ms)
   */
  scheduleRequest: async <T>(
    key: string, 
    callback: () => Promise<T>, 
    forceNow: boolean = false,
    skipCache: boolean = false,
    cacheTime: number = CACHE_VALIDITY
  ): Promise<T | null> => {
    // Verificar se este é um endpoint da roleta e redirecionar para a API
    const isRouletteEndpoint = PROXY_ENDPOINTS.some(endpoint => key.includes(endpoint));
    
    if (isRouletteEndpoint) {
      logger.debug(`Redirecionando requisição ${key} para API backend`);
      
      const standardizedKey = 'ROULETTES_PROXY';
      
      // Se já existe uma requisição em andamento para este endpoint, retornar a mesma promessa
      if (pendingRequests.has(standardizedKey)) {
        logger.debug(`Reaproveitando requisição pendente para ${standardizedKey}`);
        return pendingRequests.get(standardizedKey);
      }
      
      // Verificar o cache primeiro se não estiver forçando nova requisição
      if (!skipCache) {
        const cached = responseCache.get(standardizedKey);
        if (cached && (Date.now() - cached.timestamp < cacheTime)) {
          logger.debug(`Usando dados em cache para ${standardizedKey}, idade: ${Math.round((Date.now() - cached.timestamp)/1000)}s`);
          // Notificar subscribers mesmo quando usando cache
          RequestThrottler.notifySubscribers(standardizedKey, cached.data);
          RequestThrottler.notifySubscribers(key, cached.data);
          return cached.data;
        }
      }
      
      // Verificar se passou tempo suficiente desde a última requisição
      const now = Date.now();
      const lastRequestTime = lastRequestTimes.get(standardizedKey) || 0;
      const timeSinceLastRequest = now - lastRequestTime;
      
      // Se não passou tempo suficiente e não é forçado, agendar para depois
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && !forceNow) {
        const timeToWait = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        
        logger.debug(
          `Respeitando limite de requisições. Aguardando ${Math.round(timeToWait/1000)}s antes de acessar a API`
        );
        
        // Aguardar o tempo necessário antes de fazer a requisição
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }
      
      // Criar uma nova promessa para a requisição
      const requestPromise = (async () => {
        try {
          // Atualizar o tempo da última requisição
          lastRequestTimes.set(standardizedKey, Date.now());
          
          // Determinar qual endpoint usar baseado nas tentativas anteriores
          const currentUrl = useBackupEndpoint ? BACKUP_API_URL : BACKEND_API_URL;
          logger.debug(`Buscando dados da API: ${currentUrl} (${useBackupEndpoint ? 'backup' : 'principal'})`);
          
          // Tentar obter uma resposta com timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
          
          // Fazer requisição para a API
          const response = await fetch(currentUrl, {
            method: 'GET',
            headers: getDefaultHeaders(),
            signal: controller.signal,
            credentials: 'omit' // Evitar envio de cookies que podem causar problemas CORS
          });
          
          // Limpar o timeout
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Erro ao buscar dados da API: ${response.status} ${response.statusText}`);
          }
          
          // Parse do JSON
          const data = await response.json();
          
          // Resetar a flag de uso do endpoint backup se teve sucesso
          if (useBackupEndpoint) {
            logger.debug("Endpoint de backup funcionou, voltando para o endpoint principal na próxima requisição");
            useBackupEndpoint = false;
          }
          
          // Verificar se os dados são válidos (array não vazio)
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Dados retornados inválidos ou vazios");
          }
          
          // Armazenar no cache global
          responseCache.set(standardizedKey, {
            data,
            timestamp: Date.now()
          });
          
          // Notificar todos que estão inscritos para atualizações
          RequestThrottler.notifySubscribers(standardizedKey, data);
          
          // Notificar também aqueles inscritos na chave original
          RequestThrottler.notifySubscribers(key, data);
          
          return data;
        } catch (error) {
          logger.error(`Erro ao buscar dados da API: ${error.message}`);
          
          // Registrar falha para alternar endpoints na próxima tentativa
          lastFailedAttempt = Date.now();
          
          // Se o endpoint principal falhou, tentar o backup na próxima chamada
          if (!useBackupEndpoint) {
            logger.debug("Endpoint principal falhou, tentando backup na próxima requisição");
            useBackupEndpoint = true;
          } 
          // Se o backup falhou, tentar o fallback imediatamente
          else if (useBackupEndpoint) {
            logger.debug("Endpoints principal e backup falharam, utilizando dados fallback");
            
            // Tentar usar fallback
            const fallbackData = FALLBACK_ROULETTES;
            
            // Armazenar no cache para evitar muitas requisições em caso de falha persistente
            responseCache.set(standardizedKey, {
              data: fallbackData,
              timestamp: Date.now() - (cacheTime / 2) // Cache com "meia-vida" para tentar de novo depois
            });
            
            // Notificar
            RequestThrottler.notifySubscribers(standardizedKey, fallbackData);
            RequestThrottler.notifySubscribers(key, fallbackData);
            
            return fallbackData;
          }
          
          // Em caso de erro, verificar se temos cache (mesmo que vencido)
          const cached = responseCache.get(standardizedKey);
          if (cached) {
            logger.debug(`Usando cache (possivelmente antigo) devido a erro na requisição`);
            return cached.data;
          }
          
          // Se não temos cache, retornar o fallback
          logger.debug(`Sem cache disponível, usando dados fallback`);
          return FALLBACK_ROULETTES;
        } finally {
          // Remover a requisição do mapa de pendentes
          pendingRequests.delete(standardizedKey);
        }
      })();
      
      // Armazenar a promessa para reuso
      pendingRequests.set(standardizedKey, requestPromise);
      
      // Retornar a promessa
      return requestPromise;
    }
    
    // Se não é roleta, seguir com o fluxo normal
    // Verificar o cache primeiro se não estiver forçando nova requisição
    if (!skipCache) {
      const cached = responseCache.get(key);
      if (cached && (Date.now() - cached.timestamp < cacheTime)) {
        logger.debug(`Usando dados em cache para ${key}, idade: ${Math.round((Date.now() - cached.timestamp)/1000)}s`);
        // Notificar subscribers mesmo quando usando cache
        RequestThrottler.notifySubscribers(key, cached.data);
        return cached.data;
      }
    }

    // Se já existe uma requisição em andamento para este endpoint, retornar a mesma promessa
    if (pendingRequests.has(key)) {
      logger.debug(`Reaproveitando requisição pendente para ${key}`);
      return pendingRequests.get(key);
    }

    // Cancelar qualquer intervalo existente para este endpoint
    if (activeIntervals.has(key)) {
      clearTimeout(activeIntervals.get(key));
      activeIntervals.delete(key);
    }

    const now = Date.now();
    const lastRequestTime = lastRequestTimes.get(key) || 0;
    const timeSinceLastRequest = now - lastRequestTime;

    // Se passou menos tempo que o intervalo mínimo e não é forçado, agendar para depois
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL && !forceNow) {
      const timeToWait = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      
      logger.debug(
        `Agendando requisição para ${key} em ${Math.round(timeToWait/1000)}s`
      );
      
      const timeoutPromise = new Promise<T | null>((resolve) => {
        const timeout = setTimeout(async () => {
          try {
            // Se o endpoint já tiver sido chamado por outra instância nesse meio tempo
            if (pendingRequests.has(key)) {
              logger.debug(`Usando requisição que já está em andamento para ${key}`);
              resolve(await pendingRequests.get(key));
              return;
            }
            
            const result = await RequestThrottler.executeAndNotify(key, callback);
            resolve(result);
          } finally {
            pendingRequests.delete(key);
          }
        }, timeToWait);
        
        activeIntervals.set(key, timeout);
      });
      
      // Armazenar no mapa de pendentes
      pendingRequests.set(key, timeoutPromise);
      
      return timeoutPromise;
    }
    
    // Executar imediatamente se passou tempo suficiente ou se é forçado
    const execPromise = RequestThrottler.executeAndNotify(key, callback);
    
    // Armazenar no mapa de pendentes e depois remover quando terminar
    pendingRequests.set(key, execPromise);
    execPromise.finally(() => {
      pendingRequests.delete(key);
    });
    
    return execPromise;
  },

  /**
   * Notifica todos os inscritos para uma chave
   */
  notifySubscribers: (key: string, data: any): void => {
    const callbackList = subscribers.get(key) || [];
    if (callbackList.length > 0) {
      logger.debug(`Notificando ${callbackList.length} inscritos para ${key}`);
      callbackList.forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          logger.error(`Erro ao notificar inscrito: ${error.message}`);
        }
      });
    }
  },

  /**
   * Executa o callback e notifica todos os inscritos
   */
  executeAndNotify: async <T>(
    key: string, 
    callback: () => Promise<T>
  ): Promise<T | null> => {
    try {
      // Atualizar tempo da última requisição
      lastRequestTimes.set(key, Date.now());
      
      // Executar requisição
      logger.debug(`Executando requisição para ${key}`);
      const result = await callback();
      
      // Armazenar no cache
      responseCache.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      // Notificar todos os inscritos
      RequestThrottler.notifySubscribers(key, result);
      
      return result;
    } catch (error) {
      logger.error(`Erro na requisição ${key}:`, error);
      return null;
    }
  },

  /**
   * Inscreve um callback para ser notificado quando houver atualizações
   * @param key Identificador da requisição
   * @param callback Função a ser chamada quando houver atualização
   * @returns Uma função para cancelar a inscrição
   */
  subscribeToUpdates: (key: string, callback: (data: any) => void): () => void => {
    if (!subscribers.has(key)) {
      subscribers.set(key, []);
    }
    
    const callbackList = subscribers.get(key)!;
    callbackList.push(callback);
    
    logger.debug(`Novo inscrito para ${key}, total: ${callbackList.length}`);
    
    // Se existe cache, notificar imediatamente o novo subscriber
    const cached = responseCache.get(key);
    if (cached) {
      setTimeout(() => callback(cached.data), 0);
    }
    
    // Retornar função para cancelar inscrição
    return () => {
      RequestThrottler.unsubscribeFromUpdates(key, callback);
    };
  },

  /**
   * Remove a inscrição de um callback
   */
  unsubscribeFromUpdates: (key: string, callback: (data: any) => void): void => {
    if (!subscribers.has(key)) return;
    
    const callbackList = subscribers.get(key)!;
    const index = callbackList.indexOf(callback);
    
    if (index !== -1) {
      callbackList.splice(index, 1);
      logger.debug(`Inscrito removido de ${key}, restantes: ${callbackList.length}`);
    }
    
    // Remover o key se não houver mais inscritos
    if (callbackList.length === 0) {
      subscribers.delete(key);
      
      // Também cancelar qualquer requisição pendente
      if (activeIntervals.has(key)) {
        clearTimeout(activeIntervals.get(key));
        activeIntervals.delete(key);
      }
    }
  },

  /**
   * Limpa o cache para uma chave específica ou todo o cache
   * @param key Identificador da requisição (opcional)
   */
  clearCache: (key?: string): void => {
    if (key) {
      responseCache.delete(key);
      logger.debug(`Cache limpo para ${key}`);
    } else {
      responseCache.clear();
      logger.debug(`Cache global limpo`);
    }
  },
  
  /**
   * Obtém os headers padrão para requisições
   * @param additionalHeaders Headers adicionais para mesclar
   */
  getDefaultHeaders: (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
    return {
      ...getDefaultHeaders(),
      ...additionalHeaders
    };
  },

  executeRequest: async function(endpoint: string, requestFn: Function) {
    try {
      // Verificar se o endpoint tem encaminhamento especial
      if (this.shouldUseProxy(endpoint)) {
        console.log(`[RequestThrottler] Usando proxy para endpoint: ${endpoint}`);
        return this.executeProxyRequest(endpoint, requestFn);
      }

      // Realizar a requisição
      const response = await requestFn();
      
      // Atualizar o cache com a resposta
      responseCache.set(endpoint, {
        data: response,
        timestamp: Date.now()
      });
      
      // Registrar o tempo da última requisição
      lastRequestTimes.set(endpoint, Date.now());
      
      // Notificar os assinantes
      this.notifySubscribers(endpoint, response);
      
      return response;
    } catch (error) {
      // Se falhou, tentar usar o proxy como fallback
      if (!endpoint.includes('/api/proxy-')) {
        try {
          console.log(`[RequestThrottler] Tentando proxy como fallback para: ${endpoint}`);
          const proxyEndpoint = `/api/proxy-roulette`;
          
          // Verificar se temos um cache válido para o proxy
          const proxyCache = responseCache.get(proxyEndpoint);
          if (proxyCache && (Date.now() - proxyCache.timestamp < this.CACHE_VALIDITY)) {
            console.log(`[RequestThrottler] Usando cache do proxy para: ${endpoint}`);
            return proxyCache.data;
          }
          
          // Tentar usar o proxy
          const proxyResponse = await fetch(proxyEndpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }).then(res => res.json());
          
          // Atualizar cache com resposta do proxy
          responseCache.set(proxyEndpoint, {
            data: proxyResponse,
            timestamp: Date.now()
          });
          
          return proxyResponse;
        } catch (proxyError) {
          console.error(`[RequestThrottler] Falha no proxy: ${proxyError.message}`);
        }
      }
      
      // Verificar se temos um cache para retornar, mesmo que antigo
      const cache = responseCache.get(endpoint);
      if (cache) {
        console.log(`[RequestThrottler] Usando cache expirado após erro para: ${endpoint}`);
        return cache.data;
      }
      
      // Lançar o erro original se não conseguimos recuperar
      throw error;
    }
  },
  
  // Método para determinar se um endpoint deve usar o proxy
  shouldUseProxy: function(endpoint: string): boolean {
    // Endpoints que devem sempre tentar usar o proxy
    const proxyPreferredEndpoints = [
      '/api/ROULETTES',
      '/ROULETTES'
    ];
    
    return proxyPreferredEndpoints.some(e => endpoint.includes(e));
  },
  
  // Executar request via proxy
  executeProxyRequest: async function(endpoint: string, fallbackRequestFn: Function) {
    try {
      const proxyEndpoint = `/api/proxy-roulette`;
      
      // Tentar usar o proxy
      const response = await fetch(proxyEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Atualizar o cache com a resposta
        responseCache.set(endpoint, {
          data: data,
          timestamp: Date.now()
        });
        
        // Registrar o tempo da última requisição
        lastRequestTimes.set(endpoint, Date.now());
        
        // Notificar os assinantes
        this.notifySubscribers(endpoint, data);
        
        return data;
      } else {
        // Se o proxy falhou, voltar para a requisição original
        return fallbackRequestFn();
      }
    } catch (error) {
      console.error(`[RequestThrottler] Erro no proxy: ${error.message}, tentando requisição direta`);
      return fallbackRequestFn();
    }
  },
}; 