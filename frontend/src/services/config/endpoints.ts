/**
 * Configuração dos endpoints para comunicação com a API
 */

// URL base da API
export const BASE_URL = process.env.REACT_APP_API_URL || 'https://api.runcash.app/api';

// Lista de endpoints
export const ENDPOINTS = {
  // Endpoints de roletas
  ROULETTES: `${BASE_URL}/roulettes`,
  ROULETTE_BY_ID: (id: string) => `${BASE_URL}/roulettes/${id}`,
  ROULETTE_STRATEGY: (id: string) => `${BASE_URL}/roulettes/${id}/strategy`,
  
  // Socket.io URL
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'wss://socket.runcash.app',
};

// Eventos para comunicação via WebSocket
export const SOCKET_EVENTS = {
  // Eventos de roleta
  SUBSCRIBE_ROULETTE: 'subscribe_roulette',
  NEW_NUMBER: 'new_number',
  STRATEGY_UPDATE: 'strategy_update',
  
  // Eventos do sistema
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'connect_error',
};

// Tempo (ms) para considerar um endpoint como timeout
export const REQUEST_TIMEOUT = 15000; 