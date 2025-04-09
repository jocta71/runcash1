/**
 * Configuração dos endpoints para comunicação com a API
 */

// URL base da API
export const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.runcash.app/api';

// Lista de endpoints
export const ENDPOINTS = {
  // Endpoints de roletas
  ROULETTES: `${BASE_URL}/roulettes`,
  ROULETTE_BY_ID: (id: string) => `${BASE_URL}/roulettes/${id}`,
  ROULETTE_STRATEGY: (id: string) => `${BASE_URL}/roulettes/${id}/strategy`,
};

// Tipos de eventos do sistema (apenas para compatibilidade)
export const EVENT_TYPES = {
  // Eventos de roleta
  NEW_NUMBER: 'new_number',
  STRATEGY_UPDATE: 'strategy_update',
  
  // Eventos do sistema
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'connect_error',
};

// Tempo (ms) para considerar um endpoint como timeout
export const REQUEST_TIMEOUT = 15000; 