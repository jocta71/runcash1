/**
 * Arquivo de constantes da aplicação
 */

// URL base da API
export const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://runcashh111.vercel.app'  // URL de produção
  : window.location.hostname === 'localhost'
    ? 'http://localhost:3000'  // URL de desenvolvimento local
    : 'https://runcashh111.vercel.app';  // URL de desenvolvimento

// Outras constantes globais podem ser adicionadas aqui 