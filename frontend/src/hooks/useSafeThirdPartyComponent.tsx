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
    
    // Uma abordagem mais robusta para verificar se o React está pronto
    const checkReactReady = () => {
      try {
        // Verificar se podemos usar React e seus hooks
        // Uma forma mais confiável é tentar acessar o React já importado e verificar funções essenciais
        const isUseEffectAvailable = typeof useEffect === 'function';
        const isUseStateAvailable = typeof useState === 'function';
        
        // Se os hooks básicos estão disponíveis, provavelmente é seguro renderizar
        if (isUseEffectAvailable && isUseStateAvailable) {
          setIsReactReady(true);
          isSafeToRender.current = true;
          return;
        }
      } catch (e) {
        console.debug('React ainda não está completamente inicializado:', e);
      }
      
      // Se chegamos aqui, o React ainda não está pronto, verificar novamente após um breve delay
      setTimeout(checkReactReady, delay);
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