import React from 'react';

interface AuthRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que substitui a verificação de autenticação
 * Sempre permite acesso ao conteúdo sem verificação
 */
const AuthRoute: React.FC<AuthRouteProps> = ({ children }) => {
  // Retorna diretamente o conteúdo, sem verificações
  return <>{children}</>;
};

export default AuthRoute; 