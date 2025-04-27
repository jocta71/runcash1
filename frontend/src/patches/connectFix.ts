/**
 * Este arquivo contém patches para corrigir problemas de inicialização e conexão
 * na aplicação, especialmente relacionados ao EventService e RESTSocketService
 */

import EventService from '../services/EventService';
import RESTSocketService from '../services/RESTSocketService';
import SocketService from '../services/SocketService';
import { getLogger } from '../services/utils/logger';

// Logger para depuração
const logger = getLogger('ConnectFixPatch');

/**
 * Tenta recuperar o EventService e corrigir qualquer erro de inicialização
 */
export function fixEventServiceConnection() {
  logger.info('Aplicando patch para EventService');
  
  try {
    // Tentar recuperar a instância do EventService
    const eventService = EventService;
    
    // Verificar se temos métodos importantes
    if (typeof (eventService as any).updatePremiumAccessStatus !== 'function') {
      logger.warn('EventService não tem o método updatePremiumAccessStatus');
      
      // Tentar adicionar o método diretamente
      (eventService as any).updatePremiumAccessStatus = function(hasPremiumAccess: boolean) {
        logger.info(`Patch: Atualizando status de acesso premium: ${hasPremiumAccess}`);
        (this as any).hasPremiumAccess = hasPremiumAccess;
      };
    }
    
    return true;
  } catch (error) {
    logger.error('Erro ao aplicar patch para EventService:', error);
    return false;
  }
}

/**
 * Tenta recuperar o RESTSocketService e corrigir qualquer erro de inicialização
 */
export function fixRESTSocketServiceConnection() {
  logger.info('Aplicando patch para RESTSocketService');
  
  try {
    // Tentar recuperar a instância do RESTSocketService
    const restSocketService = RESTSocketService;
    
    // Verificar se temos métodos importantes
    if (typeof (restSocketService as any).updatePremiumAccessStatus !== 'function') {
      logger.warn('RESTSocketService não tem o método updatePremiumAccessStatus');
      
      // Tentar adicionar o método diretamente
      (restSocketService as any).updatePremiumAccessStatus = function(hasPremiumAccess: boolean) {
        logger.info(`Patch: Atualizando status de acesso premium: ${hasPremiumAccess}`);
        (this as any).hasPremiumAccess = hasPremiumAccess;
      };
    }
    
    return true;
  } catch (error) {
    logger.error('Erro ao aplicar patch para RESTSocketService:', error);
    return false;
  }
}

/**
 * Verifica se um serviço possui o método connect e, se não tiver, adiciona um connect vazio
 * para evitar erros de execução em código que espera por esse método.
 */
function ensureConnectMethod(service: any, serviceName: string): void {
  if (!service.connect && typeof service.connect !== 'function') {
    logger.info(`Adicionando método connect para ${serviceName}`);
    service.connect = function() {
      logger.debug(`Método connect chamado para ${serviceName} (patched)`);
      return Promise.resolve();
    };
  }
}

/**
 * Aplica patches em todos os serviços de socket para garantir
 * que eles tenham os métodos necessários para funcionar corretamente.
 */
export function initializeSocketServices(): void {
  try {
    logger.info('Inicializando patches para serviços de socket');
    
    // Patch para EventService - estamos recebendo diretamente a instância do serviço
    logger.info('Aplicando patch para EventService');
    ensureConnectMethod(EventService, 'EventService');
    logger.info('Patch aplicado para EventService com sucesso');
    
    // Patch para SocketService
    logger.info('Aplicando patch para SocketService');
    const socketService = SocketService.getInstance();
    ensureConnectMethod(socketService, 'SocketService');
    logger.info('Patch aplicado para SocketService com sucesso');
    
    logger.info('Todos os patches aplicados com sucesso');
  } catch (error) {
    logger.error('Erro ao aplicar patches para serviços de socket:', error);
  }
}

export default {
  fixEventServiceConnection,
  fixRESTSocketServiceConnection,
  initializeSocketServices
}; 