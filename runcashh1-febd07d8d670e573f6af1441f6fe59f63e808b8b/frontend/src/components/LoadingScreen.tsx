import React from 'react';
import GlowingCubeLoader from './GlowingCubeLoader';

interface LoadingScreenProps {
  message?: string;
}

/**
 * Componente de tela de carregamento que exibe um cubo animado centralizado
 * Usado durante o carregamento de rotas em Suspense
 */
const LoadingScreen = ({ message }: LoadingScreenProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <GlowingCubeLoader />
      {message && (
        <p className="mt-4 text-primary font-medium animate-pulse">{message}</p>
      )}
    </div>
  );
};

export default LoadingScreen; 