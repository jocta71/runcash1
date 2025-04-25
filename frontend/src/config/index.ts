/**
 * Arquivo de configuração principal
 * Exporta valores de ambiente e constantes para uso em toda a aplicação
 */

import { getRequiredEnvVar } from './env';

// URL da API - será usada para todas as requisições ao backend
export const API_URL = getRequiredEnvVar('VITE_API_URL') || 'https://api.runcash.live/api';

// Exportar outras constantes conforme necessário
export * from './constants'; 