/**
 * Este arquivo serve como wrapper para o SocketService
 * e resolve o problema com a referência DH no código compilado
 */

import SocketService from './SocketService';

// Exporte a instância singleton
const socketService = SocketService.getInstance();

// Crie um alias DH que aponta para o socketService
// Isso corrige o erro "DH.loadHistoricalRouletteNumbers is not a function"
const DH = socketService;

export { DH, socketService };
export default socketService; 