/**
 * Este arquivo agora apenas reexporta o RESTSocketService
 * para manter compatibilidade com o código existente
 * 
 * Isso nos permite remover a dependência do WebSocket e usar apenas a API REST
 */

import RESTSocketService from "./RESTSocketService";

// Re-exportar como SocketService para manter compatibilidade
export default RESTSocketService;

// Re-exportar também os tipos
export type {
  HistoryRequest,
  HistoryData
} from "./RESTSocketService";