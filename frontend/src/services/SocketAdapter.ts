/**
 * SocketAdapter.ts
 * 
 * Este adaptador permite a troca entre implementações de socket (WebSocket e REST API)
 * dependendo do ambiente ou configuração
 */

import RESTSocketService from './RESTSocketService';

// Exportar o serviço REST como implementação padrão
export default RESTSocketService;

// Nota: Este arquivo serve como ponto de entrada único para substituir o WebSocket.
// Importe este arquivo em vez de SocketService ou RESTSocketService. 