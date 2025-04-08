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

// Intervalo mínimo entre requisições (30 segundos)
const MIN_REQUEST_INTERVAL = 30 * 1000; 

// Tempo de validade do cache (5 minutos)
const CACHE_VALIDITY = 5 * 60 * 1000;

// Endpoints prioritários que devem usar o proxy-roulette
const PROXY_ENDPOINTS = ['/api/ROULETTES', '/ROULETTES', 'ROULETTES', 'roulettes'];

// Headers para evitar detecção como bot ou captchas
const getDefaultHeaders = () => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'ngrok-skip-browser-warning': 'true',
  'bypass-tunnel-reminder': 'true',
  'Origin': window.location.origin,
  'Referer': window.location.origin
});

/**
 * Controlador de taxa de requisições para evitar múltiplas chamadas em curto espaço de tempo
 */
export const RequestThrottler = {
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
    // Verificar se este é um endpoint da roleta e redirecionar para proxy-roulette
    const isRouletteEndpoint = PROXY_ENDPOINTS.some(endpoint => key.includes(endpoint));
    
    if (isRouletteEndpoint) {
      logger.debug(`Redirecionando requisição ${key} para o proxy central`);
      
      const standardizedKey = 'ROULETTES_PROXY';
      
      // Se já existe uma requisição em andamento para este endpoint, retornar a mesma promessa
      if (pendingRequests.has(standardizedKey)) {
        logger.debug(`Reaproveitando requisição pendente para ${standardizedKey}`);
        return pendingRequests.get(standardizedKey);
      }
      
      // Criar uma nova promessa para a requisição
      const requestPromise = (async () => {
        try {
          logger.debug(`Buscando dados via proxy-roulette centralizado`);
          
          // Fazer requisição para o proxy centralizado
          const proxyResponse = await fetch('/api/proxy-roulette');
          
          if (!proxyResponse.ok) {
            throw new Error(`Erro ao buscar dados do proxy: ${proxyResponse.status}`);
          }
          
          const data = await proxyResponse.json();
          
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
          logger.error(`Erro ao buscar dados via proxy: ${error.message}`);
          
          // Em caso de erro, verificar se temos cache
          const cached = responseCache.get(standardizedKey);
          if (cached) {
            logger.debug(`Usando cache devido a erro na requisição`);
            return cached.data;
          }
          
          throw error;
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
  }
}; 