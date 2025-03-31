import React, { createContext, useContext } from 'react';

interface User {
  id: string;
  email: string;
  user_metadata: {
    name?: string;
    avatar_url?: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<{ error: any }>;
  signUp: () => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Criar usuário mock que será usado automaticamente
const mockUser: User = {
  id: 'mock-user-id',
  email: 'user@example.com',
  user_metadata: {
    name: 'Usuário Demo',
    avatar_url: 'https://ui-avatars.com/api/?name=User&background=random'
  }
};

// Criar contexto com valor padrão
const AuthContext = createContext<AuthContextType>({
  user: mockUser, // Sempre ter um usuário autenticado
  loading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => {},
  signInWithGitHub: async () => {},
  signOut: async () => {}
});

/**
 * Provedor de autenticação que sempre fornece um usuário autenticado
 * Sem necessidade de login real
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Implementações mock dos métodos de autenticação
  const signIn = async () => {
    console.log('[MOCK] Login automático simulado');
    return { error: null };
  };

  const signUp = async () => {
    console.log('[MOCK] Cadastro automático simulado');
    return { error: null };
  };

  const signInWithGoogle = async () => {
    console.log('[MOCK] Login com Google simulado');
  };

  const signInWithGitHub = async () => {
    console.log('[MOCK] Login com GitHub simulado');
  };

  const signOut = async () => {
    console.log('[MOCK] Logout simulado (usuário permanece autenticado)');
  };

  // Valor do contexto sempre fornece um usuário autenticado
  const value = {
    user: mockUser,
    loading: false,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGitHub,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook para usar o contexto de autenticação
 * Sempre fornece um usuário autenticado
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
