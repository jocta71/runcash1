import { useEffect, useRef, useState } from 'react';

/**
 * Hook para trabalhar com segurança com componentes de terceiros
 * que possam estar usando useLayoutEffect de forma não segura
 * 
 * Este hook ajuda a garantir que o componente seja renderizado
 * apenas no ambiente cliente, após o React ser totalmente inicializado.
 * 
 * @param options Opções de configuração
 * @returns Objeto com flags de segurança
 */
const useSafeThirdPartyComponent = (options: {
  delay?: number;
  skipClientCheck?: boolean;
} = {}) => {
  const { delay = 50, skipClientCheck = false } = options;
  
  // Referência para rastrear se o componente está seguro para renderizar
  const isSafeToRender = useRef(false);
  const [isClient, setIsClient] = useState(false);
  const [isReactReady, setIsReactReady] = useState(false);
  
  // Verificar se estamos no cliente
  useEffect(() => {
    if (skipClientCheck) {
      setIsClient(true);
      return;
    }
    
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, [skipClientCheck]);
  
  // Verificar se o React está completamente inicializado
  useEffect(() => {
    if (!isClient) return;
    
    // Verificar se React e hooks estão disponíveis
    const checkReactReady = () => {
      const isReactAvailable = 
        typeof window !== 'undefined' && 
        window.React && 
        typeof window.React.useLayoutEffect === 'function';
      
      if (isReactAvailable) {
        setIsReactReady(true);
        isSafeToRender.current = true;
      } else {
        // Verificar novamente após um breve delay
        setTimeout(checkReactReady, delay);
      }
    };
    
    checkReactReady();
  }, [isClient, delay]);
  
  // Função utilitária para envolver componentes possivelmente inseguros
  const renderSafely = (component: React.ReactNode, fallback: React.ReactNode = null) => {
    if (isSafeToRender.current && isClient && isReactReady) {
      return component;
    }
    return fallback;
  };
  
  return {
    isClient,
    isReactReady,
    isSafeToRender: isSafeToRender.current,
    renderSafely
  };
};

export default useSafeThirdPartyComponent; 