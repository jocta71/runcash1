/**
 * Adaptador para uso de REST API em vez de WebSocket
 * 
 * Este arquivo serve como uma barreira que permite migrar do
 * SocketService (baseado em WebSocket) para o RESTSocketService (baseado em API REST)
 * sem precisar alterar todos os arquivos que importam o SocketService.
 */

import RESTSocketService from './RESTSocketService';

// Re-exportar o RESTSocketService como "default"
export default RESTSocketService;

// Nota: Este arquivo serve como ponto de entrada único para substituir o WebSocket.
// Importe este arquivo em vez de SocketService ou RESTSocketService. 