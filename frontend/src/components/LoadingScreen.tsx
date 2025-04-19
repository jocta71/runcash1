import React from 'react';
import GlowingCubeLoader from './GlowingCubeLoader';

/**
 * Componente de tela de carregamento que exibe um cubo animado centralizado
 * Usado durante o carregamento de rotas em Suspense
 */
const LoadingScreen = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <GlowingCubeLoader size="large" showLabels={true} />
    </div>
  );
};

export default LoadingScreen; 