/**
 * Tipos relacionados ao usuário
 */

/**
 * Interface que representa um usuário no sistema
 */
export interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  googleId?: string;
  createdAt?: string | Date;
  lastLogin?: string | Date;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  subscription?: {
    id: string;
    planId: string;
    status: string;
    startDate?: string;
    endDate?: string;
    nextBillingDate?: string;
  };
}

/**
 * Objeto para credenciais de login
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Objeto para credenciais de registro
 */
export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

/**
 * Resposta da API para autenticação
 */
export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
} 