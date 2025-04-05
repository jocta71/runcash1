import { getLogger } from "./logger";

const logger = getLogger('Throttler');

// Mapa para controlar os intervalos ativos por endpoint
const activeIntervals: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Mapa para rastrear a última vez que um request foi feito por endpoint
const lastRequestTimes: Map<string, number> = new Map();

// Mapa para armazenar callbacks por endpoint
const subscribers: Map<string, Array<(data: any) => void>> = new Map();

// Intervalo mínimo entre requisições (30 segundos)
const MIN_REQUEST_INTERVAL = 30 * 1000; 

/**
 * Controlador de taxa de requisições para evitar múltiplas chamadas em curto espaço de tempo
 */
export const RequestThrottler = {
  /**
   * Agenda uma requisição para ser executada respeitando o intervalo mínimo
   * @param key Identificador único para a requisição
   * @param callback Função que executa a requisição e retorna os dados
   * @param forceNow Força a execução imediata independente do intervalo
   */
  scheduleRequest: async <T>(
    key: string, 
    callback: () => Promise<T>, 
    forceNow: boolean = false
  ): Promise<T | null> => {
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
      
      return new Promise((resolve) => {
        const timeout = setTimeout(async () => {
          const result = await RequestThrottler.executeAndNotify(key, callback);
          resolve(result);
        }, timeToWait);
        
        activeIntervals.set(key, timeout);
      });
    }
    
    // Executar imediatamente se passou tempo suficiente ou se é forçado
    return RequestThrottler.executeAndNotify(key, callback);
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
      
      // Notificar todos os inscritos
      const callbackList = subscribers.get(key) || [];
      if (callbackList.length > 0) {
        logger.debug(`Notificando ${callbackList.length} inscritos para ${key}`);
        callbackList.forEach(cb => cb(result));
      }
      
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
  }
}; 