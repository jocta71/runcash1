import React from 'react';

/**
 * Componente de tela de carregamento que exibe um spinner centralizado
 * Usado durante o carregamento de rotas em Suspense
 */
const LoadingScreen = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Carregando...</h2>
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Estabelecendo conexão em tempo real...</p>
      </div>
    </div>
  );
};

export default LoadingScreen; 