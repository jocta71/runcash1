import React from 'react';

interface PlanProtectedFeatureProps {
  children: React.ReactNode;
  featureId: string;
  fallback?: React.ReactNode;
}

/**
 * Componente que substitui a proteção de recursos baseada em planos
 * Sempre permite acesso a todos os recursos sem verificação
 */
const PlanProtectedFeature: React.FC<PlanProtectedFeatureProps> = ({ 
  children, 
  featureId, 
  fallback 
}) => {
  // Sempre renderiza o conteúdo diretamente, ignorando a verificação de plano
  return <>{children}</>;
};

export default PlanProtectedFeature; 