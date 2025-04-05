import React, { PropsWithChildren, useEffect, useState, Suspense, ErrorBoundary } from 'react';
import useSafeThirdPartyComponent from '../hooks/useSafeThirdPartyComponent';
import { LayoutEffectSolution } from '../fix-layout-effect';

interface SafeThirdPartyWrapperProps extends PropsWithChildren {
  fallback?: React.ReactNode;
  loadingMessage?: string;
  delay?: number;
  checkForReact?: boolean;
  debugMode?: boolean;
  forceRender?: boolean;
  maxRetries?: number;
}

// Componente ErrorBoundary interno para capturar erros de renderização
class ThirdPartyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode; onError: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SafeThirdPartyWrapper] Erro capturado:', error, errorInfo);
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
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
  debugMode = false,
  forceRender = false,
  maxRetries = 3
}) => {
  // Aplicar correção global assim que o componente for montado
  useEffect(() => {
    // Corrigir o React global
    if (typeof window !== 'undefined' && window.React) {
      LayoutEffectSolution.patchReactModule(window.React);
    }
  }, []);
  
  const { renderSafely, isReactReady, isClient, reactErrors } = useSafeThirdPartyComponent({
    delay,
    skipClientCheck: !checkForReact,
    debug: debugMode
  });
  
  const [hasError, setHasError] = useState(false);
  const [mountAttempts, setMountAttempts] = useState(0);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  
  // Proteção adicional - verificar novamente após um tempo
  useEffect(() => {
    if (!isReactReady && !hasError && mountAttempts < maxRetries) {
      const timer = setTimeout(() => {
        setMountAttempts(prev => prev + 1);
        debugMode && console.log(`[SafeThirdPartyWrapper] Tentativa ${mountAttempts + 1} de ${maxRetries}`);
      }, delay * 2);
      
      return () => clearTimeout(timer);
    }
  }, [isReactReady, hasError, mountAttempts, delay, maxRetries, debugMode]);
  
  // Componente de fallback padrão durante carregamento
  const defaultFallback = (
    <div className="safe-loading" style={{ 
      padding: '1rem', 
      border: '1px solid #e2e8f0', 
      borderRadius: '0.375rem', 
      margin: '0.5rem 0',
      backgroundColor: '#f9fafb'
    }}>
      <div className="loading-indicator" style={{ marginBottom: '0.5rem' }}>⏳</div>
      <p style={{ fontSize: '0.875rem', margin: '0.5rem 0' }}>{loadingMessage}</p>
      {debugMode && (
        <div className="debug-info" style={{ 
          fontSize: '0.75rem', 
          color: '#64748b', 
          marginTop: '0.5rem',
          padding: '0.5rem',
          border: '1px dashed #cbd5e1',
          borderRadius: '0.25rem'
        }}>
          <p>Cliente: {isClient ? 'Sim' : 'Não'}</p>
          <p>React pronto: {isReactReady ? 'Sim' : 'Não'}</p>
          <p>Tentativas de montagem: {mountAttempts} de {maxRetries}</p>
          <p>Erro: {hasError ? 'Sim' : 'Não'}</p>
          {(errorMessages.length > 0 || reactErrors.length > 0) && (
            <div>
              <p>Erros detectados:</p>
              <ul style={{ marginLeft: '1rem', fontSize: '0.7rem' }}>
                {errorMessages.map((err, i) => (
                  <li key={`err-${i}`} style={{ marginBottom: '0.25rem' }}>{err}</li>
                ))}
                {reactErrors.map((err, i) => (
                  <li key={`react-err-${i}`} style={{ marginBottom: '0.25rem' }}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
  
  // Usar o fallback fornecido ou o padrão
  const fallbackContent = fallback || defaultFallback;
  
  // Proteção contra erros - capturar possíveis erros do useLayoutEffect
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event && event.error) {
        const errorMsg = String(event.error);
        
        if (errorMsg.includes('useLayoutEffect') || 
            errorMsg.includes('Cannot read properties of undefined')) {
          console.warn('[SafeWrapper] Erro interceptado:', errorMsg);
          setHasError(true);
          setErrorMessages(prev => [...prev, errorMsg]);
          event.preventDefault();
          return true;
        }
      }
      return false;
    };
    
    window.addEventListener('error', handleError, true);
    return () => window.removeEventListener('error', handleError, true);
  }, []);
  
  // Manipulador de erros para ErrorBoundary
  const handleBoundaryError = (error: Error) => {
    setHasError(true);
    setErrorMessages(prev => [...prev, error.message]);
  };
  
  // Se houver erro, sempre mostrar o fallback
  if (hasError) {
    return <>{fallbackContent}</>;
  }
  
  // Forçar renderização após máximo de tentativas
  if (forceRender && mountAttempts >= maxRetries) {
    return (
      <ThirdPartyErrorBoundary fallback={fallbackContent} onError={handleBoundaryError}>
        <Suspense fallback={fallbackContent}>
          {children}
        </Suspense>
      </ThirdPartyErrorBoundary>
    );
  }
  
  // Renderiza o componente filho apenas quando for seguro
  return (
    <ThirdPartyErrorBoundary fallback={fallbackContent} onError={handleBoundaryError}>
      {renderSafely(children, fallbackContent)}
    </ThirdPartyErrorBoundary>
  );
};

export default SafeThirdPartyWrapper; 