/**
 * Serviço para gerenciar tokens de autenticação
 * Armazena e recupera tokens JWT do localStorage
 */

// Chave para armazenar o token no localStorage
const TOKEN_KEY = 'runcash_auth_token';

/**
 * Armazena o token JWT no localStorage
 * @param token Token JWT a ser armazenado
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Recupera o token JWT do localStorage
 * @returns Token JWT armazenado ou null se não existir
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Remove o token JWT do localStorage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Verifica se existe um token JWT armazenado
 * @returns true se existir um token, false caso contrário
 */
export const hasAuthToken = (): boolean => {
  return !!getAuthToken();
};

/**
 * Recupera informações do token JWT (sem verificação)
 * @returns Objeto com as informações do payload do token ou null
 */
export const getTokenInfo = (): any | null => {
  const token = getAuthToken();
  
  if (!token) {
    return null;
  }
  
  try {
    // Decodificar o token (sem verificação)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Erro ao decodificar token:', error);
    return null;
  }
}; 