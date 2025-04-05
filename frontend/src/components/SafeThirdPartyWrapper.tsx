import React, { PropsWithChildren } from 'react';
import { useSafeThirdPartyComponent } from '../hooks';

interface SafeThirdPartyWrapperProps extends PropsWithChildren {
  fallback?: React.ReactNode;
  loadingMessage?: string;
  delay?: number;
  checkForReact?: boolean;
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
  checkForReact = true
}) => {
  const { renderSafely, isReactReady, isClient } = useSafeThirdPartyComponent({
    delay,
    skipClientCheck: !checkForReact
  });
  
  // Componente de fallback padrão durante carregamento
  const defaultFallback = (
    <div className="safe-loading">
      <div className="loading-indicator"></div>
      <p>{loadingMessage}</p>
      <div className="debug-info">
        <small>Cliente: {isClient ? 'Sim' : 'Não'}</small>
        <br />
        <small>React pronto: {isReactReady ? 'Sim' : 'Não'}</small>
      </div>
    </div>
  );
  
  // Usar o fallback fornecido ou o padrão
  const fallbackContent = fallback || defaultFallback;
  
  // Renderiza o componente filho apenas quando for seguro
  return renderSafely(children, fallbackContent);
};

export default SafeThirdPartyWrapper; 