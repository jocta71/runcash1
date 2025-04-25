/**
 * Serviço para gerenciar autenticação e tokens JWT
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

/**
 * Obtém o token de autenticação armazenado
 * @returns Token JWT ou null se não estiver autenticado
 */
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Erro ao recuperar token:', error);
    return null;
  }
};

/**
 * Armazena o token de autenticação
 * @param token Token JWT recebido após autenticação
 */
export const setAuthToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Erro ao armazenar token:', error);
  }
};

/**
 * Remove o token de autenticação (logout)
 */
export const removeAuthToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Erro ao remover token:', error);
  }
};

/**
 * Verifica se o usuário está autenticado
 * @returns true se o token existir, caso contrário false
 */
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

/**
 * Armazena os dados do usuário no localStorage
 * @param userData Objeto com dados do usuário
 */
export const setUserData = (userData: Record<string, any>): void => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Erro ao armazenar dados do usuário:', error);
  }
};

/**
 * Recupera os dados do usuário do localStorage
 * @returns Objeto com dados do usuário ou null
 */
export const getUserData = (): Record<string, any> | null => {
  try {
    const userData = localStorage.getItem(USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Erro ao recuperar dados do usuário:', error);
    return null;
  }
};

/**
 * Remove os dados do usuário (logout)
 */
export const removeUserData = (): void => {
  try {
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Erro ao remover dados do usuário:', error);
  }
};

/**
 * Realiza o logout completo do usuário
 */
export const logout = (): void => {
  removeAuthToken();
  removeUserData();
}; 