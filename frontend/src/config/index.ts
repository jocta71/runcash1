/**
 * Arquivo de configuração principal
 * Exporta valores de ambiente e constantes para uso em toda a aplicação
 */

import { getRequiredEnvVar } from './env';

// URL da API - será usada para todas as requisições ao backend
// Atualizada para usar o endpoint que sabemos estar disponível
export const API_URL = getRequiredEnvVar('VITE_API_URL') || 'https://backendapi-production-36b5.up.railway.app/api';

// URL alternativa da API, caso a principal falhe
export const FALLBACK_API_URL = 'https://backendapi-production-36b5.up.railway.app/api';

// Exportar outras constantes conforme necessário
export * from './constants'; 