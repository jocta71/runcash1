import Cookies from 'js-cookie';

/**
 * Nome do cookie que armazena o token de autenticação
 */
export const TOKEN_COOKIE_NAME = 'token';

/**
 * Obtém o token de autenticação a partir de cookie ou localStorage (fallback)
 * @returns {string|null} Token de autenticação ou null se não estiver autenticado
 */
export const getAuthToken = (): string | null => {
  // Verificar primeiro no cookie (mais rápido e seguro)
  const cookieToken = Cookies.get(TOKEN_COOKIE_NAME);
  if (cookieToken) {
    return cookieToken;
  }
  
  // Verificar cookie alternativo
  const altCookieToken = Cookies.get(`${TOKEN_COOKIE_NAME}_alt`);
  if (altCookieToken) {
    return altCookieToken;
  }
  
  // Fallback para localStorage
  const localStorageToken = localStorage.getItem('auth_token_backup');
  if (localStorageToken) {
    // Opcionalmente, verificar se o token não está muito antigo
    const timestamp = localStorage.getItem('auth_token_timestamp');
    if (timestamp) {
      const tokenAge = Date.now() - parseInt(timestamp);
      // Se token tem mais de 30 dias, descartar
      if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
        return null;
      }
    }
    
    return localStorageToken;
  }
  
  // Nenhum token encontrado
  return null;
}; 