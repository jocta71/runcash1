/**
 * Utilitário para gerenciar autenticação
 * Fornece funções para armazenar, recuperar e gerenciar o token JWT
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

/**
 * Obtém o token de autenticação do localStorage
 * @returns Token JWT ou null se não estiver autenticado
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Salva o token de autenticação no localStorage
 * @param token Token JWT
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Remove o token de autenticação do localStorage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Verifica se o usuário está autenticado
 * @returns true se autenticado, false caso contrário
 */
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  
  if (!token) {
    return false;
  }
  
  // Verificar se o token está expirado
  try {
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadBase64));
    
    // Verificar expiração
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      removeAuthToken();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    removeAuthToken();
    return false;
  }
};

/**
 * Salva os dados do usuário no localStorage
 * @param userData Dados do usuário
 */
export const setUserData = (userData: any): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(userData));
};

/**
 * Obtém os dados do usuário do localStorage
 * @returns Dados do usuário ou null
 */
export const getUserData = (): any | null => {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

/**
 * Remove os dados do usuário do localStorage
 */
export const removeUserData = (): void => {
  localStorage.removeItem(USER_KEY);
};

/**
 * Realiza logout completo, removendo token e dados do usuário
 */
export const logout = (): void => {
  removeAuthToken();
  removeUserData();
}; 