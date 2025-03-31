import React from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Componente que substitui a proteção de rotas
 * Sempre permite acesso sem verificação de autenticação ou assinatura
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // Retorna diretamente o conteúdo, sem verificações
  return <>{children}</>;
};

export default ProtectedRoute;
