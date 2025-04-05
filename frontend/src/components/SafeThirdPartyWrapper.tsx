import React, { PropsWithChildren, useEffect, useState } from 'react';
import { useSafeThirdPartyComponent } from '../hooks';

interface SafeThirdPartyWrapperProps extends PropsWithChildren {
  fallback?: React.ReactNode;
  loadingMessage?: string;
  delay?: number;
  checkForReact?: boolean;
  debugMode?: boolean;
}

/**
 * Componente wrapper para renderizar componentes de terceiros com segurança
 * Evita erros de useLayoutEffect renderizando componentes apenas quando seguro
 * 
 * @example
 * <SafeThirdPartyWrapper>
 *   <RiskyThirdPartyComponent />
 * </SafeThirdPartyWrapper>
 */
const SafeThirdPartyWrapper: React.FC<SafeThirdPartyWrapperProps> = ({
  children,
  fallback,
  loadingMessage = "Carregando componente de forma segura...",
  delay = 100,
  checkForReact = true,
  debugMode = false
}) => {
  const { renderSafely, isReactReady, isClient } = useSafeThirdPartyComponent({
    delay,
    skipClientCheck: !checkForReact
  });
  
  const [hasError, setHasError] = useState(false);
  const [mountAttempts, setMountAttempts] = useState(0);
  
  // Proteção adicional - verificar novamente após um tempo
  useEffect(() => {
    if (!isReactReady && !hasError && mountAttempts < 3) {
      const timer = setTimeout(() => {
        setMountAttempts(prev => prev + 1);
      }, delay * 2);
      
      return () => clearTimeout(timer);
    }
  }, [isReactReady, hasError, mountAttempts, delay]);
  
  // Componente de fallback padrão durante carregamento
  const defaultFallback = (
    <div className="safe-loading" style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', margin: '0.5rem 0' }}>
      <div className="loading-indicator" style={{ marginBottom: '0.5rem' }}>⏳</div>
      <p style={{ fontSize: '0.875rem', margin: '0.5rem 0' }}>{loadingMessage}</p>
      {debugMode && (
        <div className="debug-info" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
          <p>Cliente: {isClient ? 'Sim' : 'Não'}</p>
          <p>React pronto: {isReactReady ? 'Sim' : 'Não'}</p>
          <p>Tentativas de montagem: {mountAttempts}</p>
          <p>Erro: {hasError ? 'Sim' : 'Não'}</p>
        </div>
      )}
    </div>
  );
  
  // Usar o fallback fornecido ou o padrão
  const fallbackContent = fallback || defaultFallback;
  
  // Proteção contra erros - capturar possíveis erros do useLayoutEffect
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event && event.error && event.error.message && 
          (event.error.message.includes('useLayoutEffect') || 
           event.error.message.includes('Cannot read properties of undefined'))) {
        console.warn('[SafeWrapper] Erro interceptado:', event.error.message);
        setHasError(true);
        event.preventDefault();
      }
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  // Se houver erro, sempre mostrar o fallback
  if (hasError) {
    return <>{fallbackContent}</>;
  }
  
  // Renderiza o componente filho apenas quando for seguro
  return <>{renderSafely(children, fallbackContent)}</>;
};

export default SafeThirdPartyWrapper; 