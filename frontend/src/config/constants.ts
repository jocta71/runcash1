/**
 * Arquivo de constantes da aplicação
 */

// URL base da API
export const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://backend-production-2f96.up.railway.app'  // URL de produção corrigida
  : window.location.hostname === 'localhost'
    ? 'http://localhost:3000'  // URL de desenvolvimento local
    : 'https://backend-production-2f96.up.railway.app';

// Outras constantes globais podem ser adicionadas aqui 